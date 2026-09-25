const axios = require("axios");

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

    const apiUrl = "https://sechno.com/api/terabox";
    const res = await axios.post(
      apiUrl,
      { url: cleanUrl },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Referer: "https://sechno.com/tools/terabox-downloader",
        },
        timeout: 20000,
      }
    );

    const data = res.data;
    if (!data || !data.success) {
      throw new Error(data?.error || "Failed to resolve TeraBox link.");
    }

    const title = data.title || "TeraBox Shared Files";
    const files = Array.isArray(data.files) ? data.files : [];
    if (files.length === 0) {
      throw new Error("No files found in TeraBox share.");
    }

    const downloads = [];
    files.forEach((f) => {
      if (f.isDir) return;

      if (f.downloadUrl) {
        downloads.push({
          type: "file",
          filename: f.filename,
          size: f.sizeFormatted || `${f.size} B`,
          quality: "Direct Download",
          url: f.downloadUrl,
        });
      }

      if (f.streamUrl) {
        downloads.push({
          type: "video",
          filename: f.filename,
          size: f.sizeFormatted || `${f.size} B`,
          quality: "Fast Stream (m3u8)",
          url: f.streamUrl,
        });
      }
    });

    const firstThumb = files.find((f) => f.thumbUrl)?.thumbUrl || "";

    return {
      status: true,
      result: {
        title,
        thumbnail: firstThumb,
        totalFiles: files.length,
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

module.exports = { scrape };
