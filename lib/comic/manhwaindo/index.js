const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Manhwaindo URL.");
    }

    let targetUrl = url.trim();

    // If manga series page provided, resolve latest chapter
    if (!targetUrl.includes("chapter") && (targetUrl.includes("/series/") || targetUrl.includes("/manga/"))) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://www.manhwaindo.my/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const chLink = $page("div.eplister a[href*='chapter'], a[href*='chapter']").first().attr("href");
      if (chLink) targetUrl = chLink.trim();
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://www.manhwaindo.my/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title, h1, title").first().text().trim();
    title = title
      .replace(/\s*—\s*Baca Online.*$/i, "")
      .replace(/\s*-\s*ManhwaIndo.*$/i, "")
      .replace(/\s*\|\s*ManhwaIndo.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    // 1. Manhwaindo uploaded images
    $("img[alt='uploaded image']").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (src && !seen.has(src.trim())) {
        seen.add(src.trim());
        downloads.push({
          type: "photo",
          quality: `Page ${downloads.length + 1}`,
          url: src.trim(),
        });
      }
    });

    // 2. Fallback reader images
    if (downloads.length === 0) {
      $("#content img, #readerarea img, main img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
        if (
          src &&
          !src.includes(".gif") &&
          !src.includes("attachments") &&
          !src.includes("banner") &&
          !src.includes("iklan") &&
          !src.includes("ads") &&
          !seen.has(src.trim())
        ) {
          seen.add(src.trim());
          downloads.push({
            type: "photo",
            quality: `Page ${downloads.length + 1}`,
            url: src.trim(),
          });
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No chapter images found on Manhwaindo page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Manhwaindo",
        thumbnail: thumbnail || downloads[0].url,
        type: "photo",
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

scrape.scrape = scrape;
scrape.direct = scrape;

module.exports = scrape;
