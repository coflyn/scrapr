const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Kiryuu URL.");
    }

    let targetUrl = url.trim();

    if (!targetUrl.includes("chapter-") && targetUrl.includes("/manga/")) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://v7.kiryuu.to/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const chapterLinks = [];
      $page("a[href*='chapter-']").each((_, el) => {
        const h = $page(el).attr("href");
        if (h && !chapterLinks.includes(h.trim())) chapterLinks.push(h.trim());
      });
      if (chapterLinks.length > 0) {
        targetUrl = chapterLinks[chapterLinks.length > 1 ? 1 : 0];
      }
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://v7.kiryuu.to/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title").text().trim() || $("title").text().trim();
    title = title
      .replace(/\s*-\s*Kiryuu.*$/i, "")
      .replace(/\s*\|\s*Kiryuu.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    $("section[data-image-data] img").each((_, el) => {
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

    if (downloads.length === 0) {
      $("#readerarea img, main img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
        if (
          src &&
          !src.includes(".gif") &&
          !src.includes("avatar") &&
          !src.includes("banner") &&
          !src.includes("logo") &&
          !src.includes("ads") &&
          !src.includes("blogger.googleusercontent") &&
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
      throw new Error("No chapter images found on Kiryuu page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Kiryuu",
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
