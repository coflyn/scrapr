const axios = require("axios");
const cheerio = require("cheerio");

const baseUrl = "https://tiktokio.com";
const regexTiktokUrl =
  /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];

    if (!regexTiktokUrl.test(cleanUrl)) {
      throw new Error("Must be a valid tiktok url.");
    }

    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: baseUrl,
      headers: {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
        Origin: baseUrl,
        Referer: baseUrl + "/",
      },
    });

    const response = await client.post("/api/v1/tk/html", {
      vid: cleanUrl,
      prefix: "tiktokio.com",
    });

    const html = response.data;
    if (!html || html.includes("Please paste a valid link") || html.includes("Error")) {
      throw new Error("Invalid link or failed to fetch data from tiktokio.");
    }

    const $ = cheerio.load(html);

    const title = $(".video-info h3").text().trim() || $("h3").text().trim() || "TikTok Content";
    const thumbnail = $(".video-info img").attr("src") || $("img").attr("src") || "";

    const authorMatch = cleanUrl.match(/@([^\/]+)/);
    const author = authorMatch ? authorMatch[1] : "Unknown";

    let isPhoto = false;
    let downloads = [];

    const isSlideshow = $(".images-grid").length > 0 || $(".image-item").length > 0;

    if (isSlideshow) {
      isPhoto = true;
      $(".image-item").each((i, el) => {
        let href = $(el).find("a").attr("href");
        if (!href) {
          href = $(el).find("img").attr("src");
        }
        if (href) {
          downloads.push({ type: "photo", url: href });
        }
      });

      const musicUrl = $("a.download-btn-purple, a:contains('Mp3'), a:contains('music')").attr("href");
      if (musicUrl) {
        downloads.push({ type: "music", url: musicUrl });
      }
    } else {
      $("a.download-btn").each((i, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim().toLowerCase();

        if (href && href !== "#") {
          if (text.includes("without watermark") || $(el).hasClass("download-btn-blue") || $(el).hasClass("download-btn-green")) {
            downloads.push({ type: "video", url: href });
          } else if (text.includes("mp3") || text.includes("music") || $(el).hasClass("download-btn-purple")) {
            downloads.push({ type: "music", url: href });
          }
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found.");
    }

    return {
      status: true,
      result: {
        title,
        author,
        thumbnail,
        type: isPhoto ? "photo" : "video",
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

module.exports = { scrape };
