const axios = require("axios");

async function scrape(url) {
  try {
    const cleanUrl = url.trim();

    const response = await axios.post(
      "https://api.zoraahub.com/fetch.php",
      { url: cleanUrl },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Origin": "https://downreels.com",
          "Referer": "https://downreels.com/",
        },
        timeout: 20000,
      }
    );

    const data = response.data;

    if (data.status !== "ok") {
      throw new Error(data.message || "Failed to retrieve media. Make sure the link is public and valid.");
    }

    const downloads = [];
    const mediaItems = data.videos || data.images || [];

    for (const item of mediaItems) {
      downloads.push({
        url: item.url,
        type: item.isVideo ? "video" : "image",
        quality: item.quality || "HD",
        thumbnail: item.thumb || null,
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found in the API response.");
    }

    return {
      status: true,
      result: {
        title: "Instagram Media",
        thumbnail: data.thumbnail || null,
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
