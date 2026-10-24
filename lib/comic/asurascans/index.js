const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Asura Scans URL.");
    }

    const cleanUrl = url.trim();
    const chapterMatch = cleanUrl.match(/comics\/([^\/]+)\/chapter\/([^\/]+)/);

    // 1. Try public official API if chapter URL matches pattern
    if (chapterMatch) {
      const [, seriesSlug, chapterSlug] = chapterMatch;
      try {
        const apiRes = await axios.get(
          `https://api.asurascans.com/api/series/${seriesSlug}/chapters/${chapterSlug}`,
          { headers: { "User-Agent": CHROME_UA }, timeout: 10000 }
        );
        const data = apiRes.data?.data;
        const ch = data?.chapter;

        if (ch?.pages && ch.pages.length > 0) {
          const seriesName = seriesSlug
            .replace(/-[a-f0-9]+$/i, "")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          const title = `${seriesName} - Chapter ${ch.number}${
            ch.title ? `: ${ch.title}` : ""
          }`;

          const downloads = ch.pages.map((p, i) => ({
            type: "photo",
            quality: `Page ${i + 1}`,
            url: p.url,
          }));

          return {
            status: true,
            result: {
              title,
              author: "Asura Scans",
              thumbnail: downloads[0]?.url || "",
              type: "photo",
              downloads,
            },
          };
        }
      } catch (_) {}
    }

    // 2. HTML Fallback
    const res = await axios.get(cleanUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://asurascans.com/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.entry-title, h1, title").first().text().trim();
    title = title
      .replace(/\s*-\s*Asura Scans.*$/i, "")
      .replace(/\s*\|\s*Asura Scans.*$/i, "")
      .trim();

    const thumbnail = $('meta[property="og:image"]').attr("content") || "";

    const downloads = [];
    const seen = new Set();

    $("img[data-page-index], div[class*='chapter'] img, #readerarea img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (
        src &&
        !src.includes("covers/") &&
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
      throw new Error("No chapter images found on Asura Scans page (may be premium/locked).");
    }

    return {
      status: true,
      result: {
        title,
        author: "Asura Scans",
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
    const res = await axios.get(
      `https://api.asurascans.com/api/series?search=${encodeURIComponent(cleanQuery)}`,
      {
        headers: { "User-Agent": CHROME_UA },
        timeout: 10000,
      }
    );
    const data = res.data?.data || [];
    const results = data.map((item) => {
      const slug = item.slug;
      const pubUrl = item.public_url || `/comics/${slug}`;
      const url = pubUrl.startsWith("http")
        ? pubUrl
        : `https://asurascans.com${pubUrl}`;
      return {
        title: item.title,
        url,
        thumbnail: item.cover || "",
        status: item.status || "",
        type: item.type || "manhwa",
      };
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
    const cleanUrl = comicUrl.trim();
    const match = cleanUrl.match(/comics\/([^\/\?#]+)/);
    const seriesSlug = match ? match[1] : cleanUrl.split("/").filter(Boolean).pop();

    if (seriesSlug) {
      try {
        const apiRes = await axios.get(
          `https://api.asurascans.com/api/series/${seriesSlug}/chapters`,
          { headers: { "User-Agent": CHROME_UA }, timeout: 10000 }
        );
        const list = apiRes.data?.data;
        if (Array.isArray(list) && list.length > 0) {
          const sorted = [...list].sort(
            (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)
          );
          const chapters = sorted.map((ch) => ({
            title: `Chapter ${ch.number}${ch.title ? `: ${ch.title}` : ""}`,
            url: `https://asurascans.com/comics/${seriesSlug}/chapter/${ch.slug}`,
          }));
          return {
            status: true,
            result: chapters,
          };
        }
      } catch (_) {}
    }

    const res = await axios.get(cleanUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://asurascans.com/" },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const chapters = [];
    $("a[href*='/chapter/']").each((_, a) => {
      const href = $(a).attr("href");
      let title = $(a).text().trim() || $(a).attr("title") || "";
      if (href && !chapters.some((c) => c.url === href)) {
        chapters.push({
          title: title.replace(/\s+/g, " "),
          url: href.startsWith("http") ? href : `https://asurascans.com${href}`,
        });
      }
    });
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
scrape.api = scrape;
scrape.search = search;
scrape.getChapters = getChapters;

module.exports = scrape;
