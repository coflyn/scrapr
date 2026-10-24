const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Komikcast URL.");
    }

    let targetUrl = url.trim();

    if (!targetUrl.includes("/chapter/") && targetUrl.includes("/manga/")) {
      const pageRes = await axios.get(targetUrl, {
        headers: { "User-Agent": CHROME_UA, Referer: "https://komikcast.info/" },
        timeout: 10000,
      });
      const $page = cheerio.load(pageRes.data);
      const chapterLinks = [];
      $page("a[href*='/chapter/']").each((_, el) => {
        const h = $page(el).attr("href");
        if (h && !chapterLinks.includes(h.trim())) chapterLinks.push(h.trim());
      });
      if (chapterLinks.length > 0) {
        const latest = chapterLinks.find((l) => !l.endsWith("/chapter/1")) || chapterLinks[0];
        targetUrl = latest.startsWith("http") ? latest : `https://komikcast.info${latest}`;
      }
    }

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://komikcast.info/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const dataPageRaw = $("#app").attr("data-page");

    if (dataPageRaw) {
      try {
        const pageData = JSON.parse(dataPageRaw);
        const manga = pageData.props?.manga || {};
        const chapter = pageData.props?.chapter || {};

        if (chapter.images && chapter.images.length > 0) {
          const title = `${manga.title || "Komikcast"} - ${
            chapter.title || `Chapter ${chapter.chapter_number || ""}`
          }`.trim();

          const author =
            manga.author && manga.author !== "-"
              ? manga.author
              : manga.artist && manga.artist !== "-"
              ? manga.artist
              : "Komikcast";

          const thumbnail = manga.poster || "";

          const downloads = chapter.images.map((img, i) => ({
            type: "photo",
            quality: `Page ${i + 1}`,
            url: img.r2_url || img.image_path,
          }));

          return {
            status: true,
            result: {
              title,
              author,
              thumbnail: thumbnail || downloads[0].url,
              type: "photo",
              downloads,
            },
          };
        }
      } catch (_) {}
    }

    const title = $("h1.entry-title").text().trim() || $("title").text().trim();
    const thumbnail = $('meta[property="og:image"]').attr("content") || "";
    const downloads = [];
    const seen = new Set();

    $(".main-reading-area img, #readerarea img").each((_, el) => {
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
      throw new Error("No chapter images found on Komikcast page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Komikcast",
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
