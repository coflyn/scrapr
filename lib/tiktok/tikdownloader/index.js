const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];
    const regex =
      /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
    if (!regex.test(cleanUrl)) {
      throw new Error("Must be a valid TikTok URL.");
    }

    const { data: res } = await axios.post(
      "https://tikdownloader.io/api/ajaxSearch",
      `q=${encodeURIComponent(cleanUrl)}&vt=id`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://tikdownloader.io",
          Referer: "https://tikdownloader.io/id",
        },
        timeout: 15000,
      }
    );

    let json = res;
    if (typeof res === "string") {
      const trimmed = res.trim();
      if (trimmed.startsWith("<") || trimmed.startsWith("<!DOCTYPE")) {
        throw new Error("TikDownloader returned an HTML error page (blocked or rate-limited).");
      }
      json = JSON.parse(trimmed);
    }

    if (!json || json.status !== "ok" || !json.data) {
      throw new Error(json?.msg || "TikDownloader extraction failed.");
    }

    const $ = cheerio.load(json.data);
    const title =
      $(".clearfix h3").first().text().trim() ||
      $("h3").first().text().trim() ||
      "TikTok Content";
    const thumbnail =
      $(".image-tik img").first().attr("src") ||
      $("img").first().attr("src") ||
      "";

    const downloads = [];

    $("a.tik-button-dl").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const text = $(el).text().trim().toLowerCase();

      if (text.includes("hd")) {
        downloads.push({ quality: "1080p", type: "video", url: href });
      } else if (text.includes("mp4 [1]") || text.includes("without watermark") || text.includes("mp4")) {
        downloads.push({ quality: "720p", type: "video", url: href });
      } else if (text.includes("mp3") || text.includes("audio")) {
        downloads.push({ quality: "audio", type: "audio", url: href });
      } else if (text.includes("photo") || text.includes("image")) {
        downloads.push({ quality: "photo", type: "photo", url: href });
      }
    });

    $(".image-item img, .photo-item img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !downloads.some((d) => d.url === src)) {
        downloads.push({ quality: "photo", type: "photo", url: src });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download links found from TikDownloader.");
    }

    const authorMatch = cleanUrl.match(/@([^\/]+)/);
    const author = authorMatch ? authorMatch[1] : "TikTok User";

    return {
      status: true,
      result: {
        title,
        author: { name: author },
        thumbnail,
        type: downloads.some((d) => d.type === "photo") ? "photo" : "video",
        downloads,
      },
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape TikTok via TikDownloader.",
    };
  }
}

module.exports = { scrape };
