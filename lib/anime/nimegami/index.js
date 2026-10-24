const axios = require("axios");
const cheerio = require("cheerio");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Nimegami URL.");
    }

    const targetUrl = url.trim();

    const res = await axios.get(targetUrl, {
      headers: { "User-Agent": CHROME_UA, Referer: "https://nimegami.id/" },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    let title = $("h1.title, h1, title").first().text().trim();
    title = title
      .replace(/\s*-\s*Nimegami.*$/i, "")
      .replace(/\s*\|\s*Nimegami.*$/i, "")
      .trim();

    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      "";

    const downloads = [];
    const seen = new Set();

    $("div.download-box a, .download-area a, table a, a[href*='/download/']").each((_, a) => {
      let href = $(a).attr("href");
      if (!href) return;
      if (href.startsWith("/")) {
        href = `https://nimegami.id${href}`;
      }

      const serverName = $(a).text().trim() || "Download";
      const parentRow = $(a).closest("tr, li, div.download-box");
      const quality =
        parentRow.find("td, strong, span.quality").first().text().trim() ||
        "Download";

      if (!seen.has(href)) {
        seen.add(href);
        downloads.push({
          type: "video",
          quality: `${quality} (${serverName})`,
          url: href,
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download links found on Nimegami page.");
    }

    return {
      status: true,
      result: {
        title,
        author: "Nimegami",
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
