const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Komiku URL.");
    }

    let targetUrl = url.trim();

    // If manga info URL provided, resolve latest chapter
    if (!targetUrl.includes("chapter") && !targetUrl.includes("/ch-") && targetUrl.includes("/manga/")) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://komiku.org/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      let chLink = $page("table.judulseries a[href*='chapter'], table.judulseries a[href*='ch-']").first().attr("href");
      if (chLink) {
        targetUrl = chLink.startsWith("http") ? chLink.trim() : new URL(chLink, targetUrl).href;
      }
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://komiku.org/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title, h1[itemprop='name'], title").first().text().trim();
    title = title
      .replace(/\s*-\s*Komiku.*$/i, "")
      .replace(/\s*\|\s*Komiku.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    $("#Baca_Komik img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (
        src &&
        !src.includes("promosi") &&
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
      throw new Error("No chapter images found on Komiku page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Komiku",
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
    const url = `https://api.komiku.org/?post_type=manga&s=${encodeURIComponent(cleanQuery)}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": CHROME_UA,
        Referer: "https://komiku.org/",
      },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $(".bge").each((_, el) => {
      const a = $(el).find(".kan a").first();
      const title = a.find("h3").text().trim() || a.text().trim();
      let href = a.attr("href") || "";
      if (href && !href.startsWith("http")) href = `https://komiku.org${href}`;
      const thumb = $(el).find(".bgei img").attr("src") || "";
      const type = $(el).find(".tpe1_inf b").text().trim() || "Manga";
      if (href && title) {
        results.push({
          title: `${title} (${type})`,
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
    let cleanUrl = comicUrl.trim();
    if (!cleanUrl.startsWith("http")) cleanUrl = `https://komiku.org${cleanUrl}`;
    const res = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": CHROME_UA,
        Referer: "https://komiku.org/",
      },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const chapters = [];
    $("#Daftar_Chapter tr, table.judulseries tr").each((_, tr) => {
      const a = $(tr).find("a[href*='chapter'], a[href*='ch-']").first();
      if (a.length) {
        let epTitle = a.text().trim() || a.attr("title") || "";
        let epUrl = a.attr("href") || "";
        if (epUrl && !epUrl.startsWith("http")) epUrl = `https://komiku.org${epUrl}`;
        if (epUrl) {
          chapters.push({
            title: epTitle,
            url: epUrl,
          });
        }
      }
    });
    // Sort ascending (Chapter 1 first)
    chapters.reverse();
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
