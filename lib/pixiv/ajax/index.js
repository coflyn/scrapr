const axios = require("axios");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    const illustIdMatch =
      url.match(/artworks\/(\d+)/) || url.match(/illust_id=(\d+)/);
    if (!illustIdMatch) throw new Error("Invalid Pixiv URL.");
    const illustId = illustIdMatch[1];

    let illustData = null;

    // 1. Official AJAX API
    try {
      const res = await axios.get(
        `https://www.pixiv.net/ajax/illust/${illustId}?lang=en`,
        {
          headers: {
            "User-Agent": CHROME_UA,
            Referer: "https://www.pixiv.net/",
          },
          timeout: 10000,
        }
      );
      if (res.data && !res.data.error && res.data.body) {
        illustData = res.data.body;
      }
    } catch (_) {}

    // 2. HTML meta-preload-data fallback (for R-18 or restricted pins)
    if (!illustData) {
      try {
        const pageRes = await axios.get(
          `https://www.pixiv.net/en/artworks/${illustId}`,
          {
            headers: {
              "User-Agent": CHROME_UA,
              "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 10000,
          }
        );
        const html = pageRes.data;
        if (typeof html === "string") {
          const match =
            html.match(/id="meta-preload-data"\s+content='([^']+)'/i) ||
            html.match(/id="meta-preload-data"\s+content="([^"]+)"/i);
          if (match && match[1]) {
            const rawContent = match[1]
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, "&");
            const preload = JSON.parse(rawContent);
            if (preload?.illust?.[illustId]) {
              illustData = preload.illust[illustId];
            }
          }
        }
      } catch (_) {}
    }

    if (!illustData) {
      throw new Error("Could not fetch Pixiv artwork data.");
    }

    const isUgoira =
      String(illustData.illustType) === "2" ||
      illustData.illustType == 2 ||
      illustData.type === "ugoira";

    const title =
      illustData.title || illustData.illustTitle
        ? `${illustData.title || illustData.illustTitle} by ${
            illustData.userName || illustData.userAccount || "Artist"
          }`
        : "Pixiv Artwork";

    const downloads = [];

    if (isUgoira) {
      const ugoiraThumb = `https://pixiv.re/${illustId}.gif`;
      downloads.push({
        type: "video",
        quality: "MP4 Animation",
        url: `https://ugoira.com/api/mp4/${illustId}`,
      });
      downloads.push({
        type: "image",
        quality: "GIF Animation",
        url: ugoiraThumb,
      });
    } else {
      const pageCount = illustData.pageCount || 1;
      const originalUrl = illustData.urls?.original;

      if (originalUrl) {
        for (let i = 0; i < pageCount; i++) {
          const quality = pageCount > 1 ? `Page ${i + 1}` : "Original";
          let pageUrl = originalUrl.replace("_p0", `_p${i}`);
          pageUrl = pageUrl.replace("i.pximg.net", "i.pixiv.re");
          downloads.push({
            type: "image",
            quality,
            url: pageUrl,
          });
        }
      } else {
        downloads.push({
          type: "image",
          quality: "Original",
          url: `https://pixiv.re/${illustId}.jpg`,
        });
      }
    }

    const thumbnail = isUgoira
      ? `https://pixiv.re/${illustId}.gif`
      : illustData.urls?.regular?.replace("i.pximg.net", "i.pixiv.re") ||
        illustData.urls?.original?.replace("i.pximg.net", "i.pixiv.re") ||
        `https://pixiv.re/${illustId}.jpg`;

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: isUgoira ? "video" : "image",
        author: {
          name: illustData.userName || "Pixiv Artist",
          id: illustData.userId || "",
        },
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
