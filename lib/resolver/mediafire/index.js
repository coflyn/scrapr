const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractCleanUrl(text) {
  if (!text || typeof text !== "string") return "";
  const match = text.match(/https?:\/\/[^\s]+/i);
  let clean = match ? match[0] : text.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  return clean;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const cleanUrl = extractCleanUrl(url);

    const res = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = typeof res.data === "string" ? res.data : "";
    if (html.includes("error.php?errno=") || res.status === 404) {
      throw new Error("MediaFire file not found or has been removed.");
    }

    const $ = cheerio.load(html);

    let directUrl = $("#downloadButton").attr("href") || "";
    if (!directUrl || !directUrl.startsWith("http")) {
      const match = html.match(
        /href=["'](https?:\/\/download\d*\.mediafire\.com\/[^"']+)["']/i,
      );
      if (match) directUrl = match[1];
    }

    if (!directUrl) {
      const aria = $('a[aria-label^="Download file"]').attr("href");
      if (aria && aria.startsWith("http")) directUrl = aria;
    }

    if (!directUrl) {
      throw new Error("Could not find direct download link on MediaFire page.");
    }

    let filename = $(".filename").first().text().trim();
    if (!filename) {
      const aria = $('a[aria-label^="Download file"]').attr("aria-label");
      if (aria) {
        filename = aria.replace(/^Download file\s*/i, "").trim();
      }
    }
    if (!filename) {
      filename = $('meta[property="og:title"]').attr("content") || "MediaFire File";
    }

    let size = "";
    const sizeLi = $("ul.details li:contains('File size:')");
    if (sizeLi.length > 0) {
      size = sizeLi.find("span").text().trim();
    }
    if (!size) {
      const sizeMatch = html.match(/\(([\d.]+\s*(?:MB|GB|KB|B))\)/i);
      if (sizeMatch) size = sizeMatch[1];
    }

    return {
      status: true,
      result: {
        title: filename,
        filename,
        size: size || "Unknown",
        url: directUrl,
        downloads: [
          {
            type: "file",
            quality: "Direct Download",
            url: directUrl,
          },
        ],
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
