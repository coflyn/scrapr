const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Google Drive URL or file ID.");
    }

    const idMatch =
      url.match(
        /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)|docs\.google\.com\/[a-z]+\/d\/)([a-zA-Z0-9_-]+)/i,
      ) || url.match(/^([a-zA-Z0-9_-]{25,50})$/);

    if (!idMatch) {
      throw new Error("Could not extract Google Drive file ID from URL.");
    }
    const id = idMatch[1];

    const directUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0`;
    const ucUrl = `https://docs.google.com/uc?export=download&id=${id}`;
    let title = "Google Drive File";

    try {
      const res = await axios.get(
        `https://drive.google.com/file/d/${id}/view`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          timeout: 8000,
        },
      );
      const $ = cheerio.load(res.data);
      title =
        $('meta[property="og:title"]').attr("content") ||
        $("title")
          .text()
          .replace(/ - Google Drive.*$/, "")
          .trim() ||
        "Google Drive File";
    } catch (_) {}

    return {
      status: true,
      result: {
        title,
        filename: title,
        fileId: id,
        url: directUrl,
        downloads: [
          {
            type: "file",
            quality: "Direct Download (CDN)",
            url: directUrl,
          },
          {
            type: "file",
            quality: "Export URL",
            url: ucUrl,
          },
        ],
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve Google Drive link.",
    };
  }
}

module.exports = { scrape };
