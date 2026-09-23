const axios = require("axios");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const isSiteAsset = (u) =>
  u.includes("s.pinimg.com") ||
  u.includes("/avatars/") ||
  u.includes("/profile/") ||
  u.includes("sprite") ||
  u.includes("favicon") ||
  u.includes("placeholder");

async function scrape(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": userAgents[0],
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const html = res.data;
    if (typeof html !== "string") {
      throw new Error("Invalid response received from Pinterest.");
    }

    let title = "Pinterest Pin";
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitle && ogTitle[1]) {
      title = ogTitle[1].replace(/\s*\|\s*Pinterest$/i, "").trim();
    }

    const downloads = [];
    const videoMatches =
      html.match(
        /https:\/\/(?:v1\.pinimg\.com|7\.pinimg\.com|v\.pinimg\.com)\/[^"'\s]+\.mp4/gi,
      ) ||
      html.match(/https:\/\/[^"'\s]+\.mp4[^\s"']*/gi) ||
      [];

    let rawImageMatches =
      html.match(
        /https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9\/._-]+\.(?:jpg|jpeg|png|webp)/gi,
      ) || [];

    if (rawImageMatches.length === 0) {
      rawImageMatches =
        html.match(
          /https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9\/._-]+\.(?:jpg|jpeg|png|webp)/gi,
        ) || [];
    }

    const uniqueVideos = [...new Set(videoMatches)];
    const uniqueImages = [...new Set(rawImageMatches.filter((u) => !isSiteAsset(u)))];

    uniqueVideos.forEach((vUrl) => {
      downloads.push({ quality: "HD Video", type: "video", url: vUrl });
    });
    uniqueImages.forEach((iUrl) => {
      downloads.push({ quality: "Original Image", type: "image", url: iUrl });
    });

    if (downloads.length === 0) {
      throw new Error("Could not find pin media links directly from Pinterest.");
    }

    return {
      status: true,
      result: {
        title,
        thumbnail: uniqueImages[0] || (uniqueVideos[0] ? downloads[0].url : ""),
        type: uniqueVideos.length > 0 ? "video" : "image",
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
