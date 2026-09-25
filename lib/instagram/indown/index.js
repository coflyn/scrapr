const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const cleanUrl = url.split("?")[0];
    const payload = new URLSearchParams();
    payload.append("q", cleanUrl);
    payload.append("vt", "reel");
    payload.append("t", "media");
    payload.append("lang", "en");
    payload.append("v", "v2");

    const res = await axios.post("https://indown.net/api/ajaxSearch", payload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://indown.net",
        Referer: "https://indown.net/",
      },
      timeout: 15000,
    });

    const json = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    if (!json || json.status !== "ok" || !json.data) {
      throw new Error(json?.mess?.replace(/<[^>]+>/g, "").trim() || "Failed to process Instagram URL on indown.net");
    }

    const $ = cheerio.load(json.data);
    const downloads = [];
    let thumbnail = null;

    const checkIsVideo = (href, text, title) => {
      const upper = (text + " " + title).toUpperCase();
      if (upper.includes("VIDEO") || upper.includes("MP4") || upper.includes("REEL")) return true;
      if (upper.includes("PHOTO") || upper.includes("IMAGE")) return false;
      try {
        const match = href.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
        if (match) {
          const payloadB64 = match[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
          const decoded = Buffer.from(payloadB64, "base64").toString("utf-8");
          if (/\.(mp4|mov|webm|mkv)(\?|"|$)/i.test(decoded)) return true;
          if (/\.(jpe?g|png|webp)(\?|"|$)/i.test(decoded)) return false;
        }
      } catch (_) {}
      return /\.(mp4|mov|webm)(\?|$)/i.test(href);
    };

    $(".download-items").each((_, el) => {
      const thumb = $(el).find("img").attr("src");
      if (thumb && !thumbnail) thumbnail = thumb;

      $(el)
        .find("a[href*='download'], a.abutton, a.btn, a[href*='snapcdn'], a[href*='rapidcdn'], a[href*='cdninstagram']")
        .each((_, a) => {
          const href = $(a).attr("href");
          if (href && href.startsWith("http") && !downloads.some((d) => d.url === href)) {
            const text = $(a).text().trim();
            const title = $(a).attr("title") || "";
            const isVideo = checkIsVideo(href, text, title);
            downloads.push({
              type: isVideo ? "video" : "image",
              url: href,
              thumbnail: thumb || href,
            });
          }
        });
    });

    if (downloads.length === 0) {
      throw new Error("No media links found. The post might be private or unavailable.");
    }

    return {
      status: true,
      result: {
        title: "Instagram Media",
        thumbnail: thumbnail || downloads[0].thumbnail,
        downloads,
      },
    };
  } catch (e) {
    return {
      status: false,
      message: e.message,
    };
  }
}

module.exports = { scrape };
