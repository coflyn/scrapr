const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Komikindo URL.");
    }

    let targetUrl = url.trim();

    // If series page provided, resolve latest chapter
    if (!targetUrl.includes("chapter") && (targetUrl.includes("/komik/") || targetUrl.includes("/manga/"))) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://komikindo.ch/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const chLink = $page("div.episodelst a[href*='chapter'], a[href*='chapter']").first().attr("href");
      if (chLink) targetUrl = chLink.trim();
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://komikindo.ch/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title, title").first().text().trim();
    title = title
      .replace(/\s*-\s*KomikIndo.*$/i, "")
      .replace(/\s*\|\s*KomikIndo.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    $("#Baca_Komik img, #chimg-auh img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (
        src &&
        !src.includes("blogger.googleusercontent") &&
        !src.includes(".gif") &&
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
      throw new Error("No chapter images found on Komikindo page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Komikindo",
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

async function search(query) {
  try {
    if (!query || typeof query !== "string") {
      throw new Error("Query is required.");
    }
    const cleanQuery = query.trim();
    const url = `https://komikindo.ch/?s=${encodeURIComponent(cleanQuery)}`;
    const res = await axios.get(url, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://komikindo.ch/" },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $(".animepost").each((_, el) => {
      const a = $(el).find(".tt h3 a").first();
      const rawTitle =
        a.text().trim() || $(el).find(".animposx a").attr("title") || "";
      const title = rawTitle.replace(/^Komik\s+/i, "").trim();
      const href = a.attr("href") || $(el).find(".animposx a").attr("href");
      const thumb = $(el).find("img").attr("src") || "";
      if (href && title) {
        results.push({
          title,
          url: href,
          thumbnail: thumb,
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

async function getChapters(comicUrl) {
  try {
    if (!comicUrl || typeof comicUrl !== "string") {
      throw new Error("Comic URL is required.");
    }
    const res = await axios.get(comicUrl.trim(), {
      headers: { "User-Agent": CHROME_UA, Referer: "https://komikindo.ch/" },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const chapters = [];
    $("#chapter_list ul li, .episodelst ul li").each((_, el) => {
      const a = $(el).find(".lchx a, a[href*='chapter']").first();
      if (a.length) {
        const title = a.text().trim();
        const url = a.attr("href");
        if (url) {
          chapters.push({
            title,
            url,
          });
        }
      }
    });
    return {
      status: true,
      result: chapters,
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
scrape.getChapters = getChapters;

module.exports = scrape;
