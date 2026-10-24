const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Otakudesu URL.");
    }

    let targetUrl = url.trim();

    // If anime series page passed, resolve latest episode
    if (!targetUrl.includes("/episode/") && targetUrl.includes("/anime/")) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://otakudesu.blog/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const epLinks = [];
      $page("a").each((_, el) => {
        const h = $page(el).attr("href");
        if (h && h.includes("/episode/")) epLinks.push(h.trim());
      });
      if (epLinks.length > 0) {
        targetUrl = epLinks[0];
      }
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://otakudesu.blog/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.posttl, h1, title").first().text().trim();
    title = title
      .replace(/\s*-\s*OtakuDesu.*$/i, "")
      .replace(/\s*\|\s*Otakudesu.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    // Helper to extract direct mp4 from player iframe URL
    async function extractMp4(playerUrl) {
      if (!playerUrl) return null;
      try {
        const pRes = await axios.get(playerUrl, {
          headers: {
            "User-Agent": CHROME_UA,
            Referer: "https://otakudesu.blog/",
          },
          timeout: 8000,
        });
        const $p = cheerio.load(pRes.data);
        let src =
          $p("video source").attr("src") ||
          $p("video").attr("src") ||
          $p("source").attr("src");
        if (!src) {
          const m = pRes.data.match(
            /(?:file|src):\s*["\x27](https?:\/\/[^"\x27]+\.mp4[^"\x27]*)["\x27]/i,
          );
          if (m) src = m[1];
        }
        if (
          src &&
          (src.includes(".mp4") ||
            src.includes("googlevideo.com") ||
            src.includes("videoplayback"))
        ) {
          return src.replace(/&amp;/g, "&");
        }
      } catch (_) {}
      return null;
    }

    // 1. Resolve default player iframe
    const streamIframe = $("iframe").first().attr("src");
    if (
      streamIframe &&
      !streamIframe.includes("google") &&
      !streamIframe.includes("ads")
    ) {
      const directMp4 = await extractMp4(streamIframe);
      if (directMp4 && !seen.has(directMp4)) {
        seen.add(directMp4);
        downloads.push({
          type: "video",
          quality: "Direct MP4 (360p)",
          url: directMp4,
          headers: {
            Referer: "https://desustream.net/",
            "User-Agent": CHROME_UA,
          },
        });
      }
    }

    // 2. Resolve mirror players (720p, 480p) via Otakudesu internal AJAX
    const actionMatches = res.data.match(
      /action:\s*["\x27]([a-f0-9]{32})["\x27]/g,
    );
    if (actionMatches && actionMatches.length >= 2) {
      const streamAction = actionMatches[0].match(/[a-f0-9]{32}/)[0];
      const nonceAction = actionMatches[1].match(/[a-f0-9]{32}/)[0];

      try {
        const nonceRes = await axios.post(
          "https://otakudesu.blog/wp-admin/admin-ajax.php",
          new URLSearchParams({ action: nonceAction }),
          {
            headers: {
              "User-Agent": CHROME_UA,
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: targetUrl,
            },
            timeout: 7000,
          },
        );
        const nonce = nonceRes.data?.data;
        if (nonce) {
          const mirrorTargets = [];
          $(".mirrorstream a[data-content]").each((_, el) => {
            const serverName = $(el).text().toLowerCase();
            if (
              serverName.includes("otakuplay") ||
              serverName.includes("otakustream") ||
              serverName.includes("desustream")
            ) {
              try {
                const raw = $(el).attr("data-content");
                const parsed = JSON.parse(
                  Buffer.from(raw, "base64").toString("utf8"),
                );
                mirrorTargets.push({
                  label: `Direct MP4 (${parsed.q || "HD"})`,
                  data: parsed,
                });
              } catch (_) {}
            }
          });

          for (const target of mirrorTargets) {
            try {
              const sRes = await axios.post(
                "https://otakudesu.blog/wp-admin/admin-ajax.php",
                new URLSearchParams({
                  ...target.data,
                  nonce,
                  action: streamAction,
                }),
                {
                  headers: {
                    "User-Agent": CHROME_UA,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: targetUrl,
                  },
                  timeout: 7000,
                },
              );
              if (sRes.data?.data) {
                const ifrHtml = Buffer.from(sRes.data.data, "base64").toString(
                  "utf8",
                );
                const ifrSrc = cheerio.load(ifrHtml)("iframe").attr("src");
                if (ifrSrc) {
                  const mp4 = await extractMp4(ifrSrc);
                  if (mp4 && !seen.has(mp4)) {
                    seen.add(mp4);
                    downloads.push({
                      type: "video",
                      quality: target.label,
                      url: mp4,
                      headers: {
                        Referer: "https://desustream.net/",
                        "User-Agent": CHROME_UA,
                      },
                    });
                  }
                }
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // 3. External Filehost mirrors (categorized as links)
    $("div.download ul li").each((_, li) => {
      const quality = $(li).find("strong").text().trim() || "Download";
      $(li)
        .find("a")
        .each((_, a) => {
          const href = $(a).attr("href");
          const serverName = $(a).text().trim();
          if (
            href &&
            !seen.has(href) &&
            !serverName.toLowerCase().includes("zippy")
          ) {
            seen.add(href);
            downloads.push({
              type: "link",
              quality: `Mirror (${quality} - ${serverName})`,
              url: href,
            });
          }
        });
    });

    if (downloads.length === 0) {
      throw new Error("No download streams found on Otakudesu page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Otakudesu",
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
    const url = `https://otakudesu.blog/?s=${encodeURIComponent(cleanQuery)}&post_type=anime`;
    const res = await axios.get(url, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://otakudesu.blog/" },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $(".chivsrc li").each((_, el) => {
      const a = $(el).find("h2 a");
      const title = a.text().trim();
      const href = a.attr("href");
      const thumbnail = $(el).find("img").attr("src") || "";
      const meta = $(el).find(".set").text().trim();
      if (href && title) {
        results.push({
          title,
          url: href,
          thumbnail,
          meta,
        });
      }
    });
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
    const res = await axios.get(animeUrl.trim(), {
      headers: { "User-Agent": CHROME_UA, Referer: "https://otakudesu.blog/" },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const episodes = [];
    $(".episodelist ul li").each((_, el) => {
      const a = $(el).find("span a");
      if (a.length) {
        const epTitle = a.text().trim();
        const epUrl = a.attr("href");
        if (epUrl && !epTitle.toLowerCase().includes("batch")) {
          episodes.push({
            title: epTitle,
            url: epUrl,
          });
        }
      }
    });
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
