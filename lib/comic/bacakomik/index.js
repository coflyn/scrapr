const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Bacakomik URL.");
    }

    let targetUrl = url.trim();

    // If manga series page provided, resolve latest chapter
    if (!targetUrl.includes("chapter") && (targetUrl.includes("/komik/") || targetUrl.includes("/manga/"))) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://bacakomik.my/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const chLink = $page("div.eps_lst a[href*='chapter'], a[href*='chapter']").first().attr("href");
      if (chLink) targetUrl = chLink.trim();
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://bacakomik.my/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title, title").first().text().trim();
    title = title
      .replace(/\s*-\s*BacaKomik.*$/i, "")
      .replace(/\s*\|\s*BacaKomik.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    $("#content img, #chimg-auh img, #readerarea img").each((_, el) => {
      const src =
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-src") ||
        $(el).attr("src");

      if (
        src &&
        !src.startsWith("data:") &&
        !src.includes(".gif") &&
        !src.includes("banner") &&
        !src.includes("iklan") &&
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

    if (downloads.length === 0) {
      throw new Error("No chapter images found on Bacakomik page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Bacakomik",
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
