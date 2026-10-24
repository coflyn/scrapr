const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid AnimeTosho URL.");
    }

    const targetUrl = url.trim();

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://animetosho.org/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("title").first().text().trim();
    title = title
      .replace(/\s*\|\s*Anime Tosho.*$/i, "")
      .replace(/\s*-\s*Anime Tosho.*$/i, "")
      .trim();

    const thumbnail = $('meta[property="og:image"]').attr("content") || "";

    const authorMatch = title.match(/^\[([^\]]+)\]/);
    const author = authorMatch ? authorMatch[1] : "AnimeTosho";

    const downloads = [];
    const seen = new Set();

    $("a").each((_, a) => {
      const href = $(a).attr("href");
      const text = $(a).text().trim();
      if (
        href &&
        (href.includes("multiup") ||
          href.includes("storage") ||
          href.includes(".torrent") ||
          href.startsWith("magnet:"))
      ) {
        if (!seen.has(href)) {
          seen.add(href);
          let quality = "Direct Download";
          if (href.startsWith("magnet:")) quality = "Magnet URI";
          else if (href.includes(".torrent")) quality = "Torrent File";
          else if (text) quality = `DDL (${text})`;

          downloads.push({
            type: "video",
            quality,
            url: href,
          });
        }
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download mirrors or torrents found on AnimeTosho page.");
    }

    return {
      status: true,
      result: {
        title,
        author,
        thumbnail,
        type: "video",
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
