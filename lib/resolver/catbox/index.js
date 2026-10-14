const axios = require("axios");
const cheerio = require("cheerio");

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let num = Number(bytes);
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(2)} ${units[i]}`;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Catbox URL.");
    }
    const cleanUrl = url.trim();

    // Album: catbox.moe/c/{id}
    const albumMatch = cleanUrl.match(/catbox\.moe\/c\/([a-zA-Z0-9]+)/i);
    if (albumMatch) {
      const res = await axios.get(cleanUrl, { timeout: 15000 });
      const $ = cheerio.load(res.data);
      const title =
        $(".title h1").text().trim() ||
        $("title").text().trim() ||
        "Catbox Collection";
      const downloads = [];

      $("a[href*='files.catbox.moe'], a[href*='litter.catbox.moe']").each(
        (_, el) => {
          const href = $(el).attr("href");
          if (href && !downloads.some((d) => d.url === href)) {
            const fn = href.split("/").pop() || "file";
            downloads.push({
              type: "file",
              filename: fn,
              quality: "Original",
              url: href,
            });
          }
        },
      );

      if (downloads.length === 0) {
        throw new Error("No files found in Catbox collection.");
      }

      return {
        status: true,
        result: {
          title,
          type: "album",
          trackCount: downloads.length,
          url: cleanUrl,
          downloads,
        },
      };
    }

    // Direct file: files.catbox.moe or litter.catbox.moe
    const targetUrl = cleanUrl.startsWith("http")
      ? cleanUrl
      : `https://${cleanUrl}`;
    const fileMatch = cleanUrl.match(
      /(?:files|litter|de)\.catbox\.moe\/([a-zA-Z0-9_.-]+)/i,
    );

    let contentLength;
    try {
      const headRes = await axios.head(targetUrl, { timeout: 10000 });
      contentLength = headRes.headers["content-length"];
    } catch (_) {
      try {
        const rangeRes = await axios.get(targetUrl, {
          headers: { Range: "bytes=0-0" },
          timeout: 10000,
        });
        contentLength =
          rangeRes.headers["content-length"] ||
          rangeRes.headers["content-range"]?.split("/")[1];
      } catch (err) {
        // Continue with unknown size
      }
    }

    const filename = fileMatch
      ? fileMatch[1]
      : targetUrl.split("/").pop().split("?")[0] || "catbox_file";

    return {
      status: true,
      result: {
        title: filename,
        filename,
        size: formatBytes(contentLength),
        url: targetUrl,
        downloads: [
          {
            type: "file",
            quality: "Direct Download",
            url: targetUrl,
          },
        ],
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve Catbox URL.",
    };
  }
}

module.exports = { scrape };
