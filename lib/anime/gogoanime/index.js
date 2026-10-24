const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function padKey(str, len) {
  const buf = Buffer.alloc(len, 0);
  const src = Buffer.from(str, "utf8");
  src.copy(buf, 0, 0, Math.min(len, src.length));
  return buf;
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decryptMegaplay(enc) {
  try {
    const gpul = "i?LMTAx0Q6,:}50U";
    const Akll = "W0;27ToaUpl_P%'c";
    const cGbm = 90;
    const cmol = "MpCdnT0k3n!9f2K#xQ7vL5mR8wN1pY4s";

    const key = padKey(gpul, 32);
    const iv = padKey(Akll, 16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const cipherBytes = b64urlDecode(enc);
    const decryptedBuf = Buffer.concat([
      decipher.update(cipherBytes),
      decipher.final(),
    ]);
    const decryptedJson = JSON.parse(decryptedBuf.toString("utf8"));

    const exp = Math.floor(Date.now() / 1000) + cGbm;
    const payload = String(exp) + "|" + enc;
    const hmac = crypto.createHmac("sha256", cmol).update(payload).digest();
    const token =
      b64urlEncode(Buffer.from(payload, "utf8")) + "." + b64urlEncode(hmac);

    return `${decryptedJson.file}?token=${token}`;
  } catch (_) {
    return null;
  }
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Gogoanime URL.");
    }

    const targetUrl = url.trim();

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("div.title_name h2, h1, title").first().text().trim();
    title = title
      .replace(/^You are Watching\s*/i, "")
      .replace(/\s*at gogoanime.*$/i, "")
      .replace(/\s*on Gogoanime.*$/i, "")
      .trim();

    let thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $("div.anime_info_body_bg img").attr("src") ||
      "";

    if (thumbnail && thumbnail.startsWith("/")) {
      const u = new URL(targetUrl);
      thumbnail = `${u.origin}${thumbnail}`;
    }

    const downloads = [];
    const seen = new Set();

    // 1. Script video_frame embed & DOM iframes
    const scripts = $("script").text();
    const frameMatch = scripts.match(
      /video_frame\.outerHTML\s*=\s*['"]<iframe[^>]+src=['"]([^'"]+)['"]/i,
    );
    let primaryEmbed = frameMatch ? frameMatch[1] : null;

    if (!primaryEmbed) {
      $("div.play-video iframe, iframe").each((_, el) => {
        let src = $(el).attr("src");
        if (
          src &&
          !src.includes("google") &&
          !src.includes("ads") &&
          !src.includes("salapis")
        ) {
          primaryEmbed = src;
          return false;
        }
      });
    }

    if (primaryEmbed) {
      if (primaryEmbed.startsWith("//")) primaryEmbed = `https:${primaryEmbed}`;
      else if (primaryEmbed.startsWith("/")) {
        const u = new URL(targetUrl);
        primaryEmbed = `${u.origin}${primaryEmbed}`;
      }

      // 1. Add web player link first (best for watching in browser)
      if (!seen.has(primaryEmbed)) {
        seen.add(primaryEmbed);
        downloads.push({
          type: "link",
          quality: "Web Player (Tonton di Browser)",
          url: primaryEmbed,
        });
      }

      // 2. Try resolving direct Megaplay HLS m3u8 stream (best for VLC/mpv/ffmpeg)
      try {
        const pRes = await axios.get(primaryEmbed, {
          headers: { "User-Agent": CHROME_UA, Referer: targetUrl },
          timeout: 7000,
        });
        const megaUrl = cheerio.load(pRes.data)("iframe").first().attr("src");
        if (megaUrl) {
          const mRes = await axios.get(megaUrl, {
            headers: { "User-Agent": CHROME_UA, Referer: primaryEmbed },
            timeout: 7000,
          });
          const dataId = cheerio
            .load(mRes.data)("#megaplay-player")
            .attr("data-id");
          if (dataId) {
            const sRes = await axios.get(
              `https://megaplay.buzz/stream/getSources?id=${dataId}&platform=OTHER`,
              {
                headers: {
                  "User-Agent": CHROME_UA,
                  Referer: megaUrl,
                  "X-Requested-With": "XMLHttpRequest",
                },
                timeout: 7000,
              },
            );
            if (sRes.data?.enc) {
              const hlsUrl = decryptMegaplay(sRes.data.enc);
              if (hlsUrl && !seen.has(hlsUrl)) {
                seen.add(hlsUrl);
                downloads.push({
                  type: "link",
                  quality: "Direct HLS Stream (Untuk VLC / mpv / ffmpeg)",
                  url: hlsUrl,
                  headers: {
                    Referer: "https://megaplay.buzz/",
                    "User-Agent": CHROME_UA,
                  },
                });
              }
            }
          }
        }
      } catch (_) {}
    }

    // 2. Multi-server mirrors
    $("div.anime_muti_link ul li a").each((_, a) => {
      const serverName =
        $(a)
          .text()
          .replace("Choose this server", "")
          .trim()
          .split(/\s{2,}|\n/)[0]
          .trim() || "Mirror";
      let videoUrl = $(a).attr("data-video");
      if (videoUrl) {
        if (videoUrl.startsWith("//")) videoUrl = `https:${videoUrl}`;
        if (!seen.has(videoUrl)) {
          seen.add(videoUrl);
          downloads.push({
            type: "link",
            quality: `Web Player (${serverName})`,
            url: videoUrl,
          });
        }
      }
    });

    // 3. Direct download link if present
    $("li.downds a").each((_, a) => {
      const href = $(a).attr("href");
      if (href && !seen.has(href)) {
        seen.add(href);
        downloads.push({
          type: "link",
          quality: "Download Mirror",
          url: href,
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No video streams found on Gogoanime page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Gogoanime",
        thumbnail,
        type: "video",
        downloads,
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

async function search(query) {
  try {
    if (!query || typeof query !== "string") {
      throw new Error("Query is required.");
    }
    const cleanQuery = query.trim();
    const mirrors = ["https://ww25.gogoanimes.fi", "https://www14.gogoanime.me"];
    let results = [];
    for (const host of mirrors) {
      try {
        const url = `${host}/search.html?keyword=${encodeURIComponent(cleanQuery)}`;
        const res = await axios.get(url, {
          headers: { "User-Agent": CHROME_UA },
          timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        $("div.last_episodes ul.items li").each((_, el) => {
          const a = $(el).find("p.name a");
          const title = a.attr("title") || a.text().trim();
          let href = a.attr("href") || "";
          if (href && !href.startsWith("http")) href = `${host}${href}`;
          let thumb = $(el).find("div.img a img").attr("src") || "";
          if (thumb && !thumb.startsWith("http")) thumb = `${host}${thumb}`;
          const released = $(el).find("p.released").text().replace(/\s+/g, " ").trim();
          if (title && href) {
            results.push({
              title: released ? `${title} (${released})` : title,
              url: href,
              thumbnail: thumb,
            });
          }
        });
        if (results.length > 0) break;
      } catch (_) {}
    }
    return {
      status: true,
      result: results,
    };
  } catch (err) {
    return {
      status: false,
      message: err.message,
    };
  }
}

async function getEpisodes(animeUrl) {
  try {
    if (!animeUrl || typeof animeUrl !== "string") {
      throw new Error("Anime URL is required.");
    }
    let cleanUrl = animeUrl.trim();
    const res = await axios.get(cleanUrl, {
      headers: { "User-Agent": CHROME_UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    const host = new URL(cleanUrl).origin;
    const episodes = [];

    // 1. Direct HTML episodes in #episode_related
    $("#episode_related li").each((_, el) => {
      const a = $(el).find("a");
      let href = a.attr("href") || "";
      let epTitle = a.find(".name").text().trim() || a.text().trim();
      if (href) {
        if (!href.startsWith("http")) href = `${host}${href}`;
        episodes.push({
          title: epTitle.toUpperCase(),
          url: href,
        });
      }
    });

    // 2. If #episode_related was empty (some mirrors load via AJAX), check movie_id and alias
    if (episodes.length === 0) {
      const movieId = $("#movie_id").val();
      const alias = $("#alias_anime").val();
      if (movieId && alias) {
        const epStart = 0;
        const epEnd = 2000;
        const ajaxHosts = [host, "https://ww25.gogoanimes.fi"];
        for (const ah of ajaxHosts) {
          try {
            const ajaxUrl = `${ah}/ajax/load-list-episode?ep_start=${epStart}&ep_end=${epEnd}&id=${movieId}&default_ep=0&alias=${alias}`;
            const ajaxRes = await axios.get(ajaxUrl, {
              headers: { "User-Agent": CHROME_UA },
              timeout: 8000,
            });
            const $a = cheerio.load(ajaxRes.data);
            $a("li a").each((_, el) => {
              let href = $a(el).attr("href") || "";
              let epTitle = $a(el).find(".name").text().trim() || $a(el).text().trim();
              if (href) {
                if (!href.startsWith("http")) href = `${host}${href}`;
                episodes.push({
                  title: epTitle.toUpperCase(),
                  url: href,
                });
              }
            });
            if (episodes.length > 0) break;
          } catch (_) {}
        }
      }
    }

    // Sort ascending (Episode 1 first)
    episodes.reverse();

    return {
      status: true,
      result: episodes,
    };
  } catch (err) {
    return {
      status: false,
      message: err.message,
    };
  }
}

scrape.scrape = scrape;
scrape.direct = scrape;
scrape.search = search;
scrape.getEpisodes = getEpisodes;

module.exports = scrape;
