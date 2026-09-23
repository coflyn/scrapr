const axios = require("axios");

async function scrape(url, options = {}) {
  try {
    const videoMatch = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    if (!videoMatch) {
      throw new Error("Invalid YouTube video URL.");
    }

    const videoId = videoMatch[1];
    const headers = {
      Origin: "https://media.ytmp3.gg",
      Referer: "https://media.ytmp3.gg/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    };

    let title = "YouTube Video";
    let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const { data: oData } = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { timeout: 5000 }
      );
      if (oData) {
        title = oData.title || title;
        thumbnail = oData.thumbnail_url || thumbnail;
      }
    } catch (_) {}

    const runConvert = async (format, quality) => {
      try {
        const { data: conv } = await axios.post(
          "https://hub.convert1s.com/api/download",
          {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            os: "macos",
            output: {
              type: format === "mp4" ? "video" : "audio",
              format,
              quality,
            },
            audio: { bitrate: "128k" },
          },
          { headers, timeout: 10000 }
        );

        if (!conv || conv.error || !conv.statusUrl) {
          return null;
        }

        let downloadUrl = null;
        let attempts = 0;
        while (!downloadUrl && attempts < 15) {
          await new Promise((r) => setTimeout(r, 1200));
          const { data: pollData } = await axios.get(conv.statusUrl, {
            headers,
            timeout: 8000,
          });
          attempts++;

          if (pollData && pollData.status === "completed" && pollData.downloadUrl) {
            downloadUrl = pollData.downloadUrl;
            break;
          }
          if (pollData && (pollData.status === "error" || pollData.status === "failed")) {
            break;
          }
        }

        return downloadUrl
          ? { url: downloadUrl, quality: conv.selectedQuality || quality, type: format === "mp4" ? "video" : "audio" }
          : null;
      } catch (_) {
        return null;
      }
    };

    const targetFormat = (options.format || "mp4").toLowerCase();
    const downloads = [];

    if (targetFormat === "mp3" || targetFormat === "audio") {
      const mp3 = await runConvert("mp3", "");
      if (mp3) downloads.push(mp3);
    } else {
      const vid = await runConvert("mp4", options.quality || "720p");
      if (vid) downloads.push(vid);

      const mp3 = await runConvert("mp3", "");
      if (mp3) downloads.push(mp3);
    }

    if (downloads.length === 0) {
      throw new Error("Could not retrieve download link from ytmp3.gg.");
    }

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: downloads.some((d) => d.type === "video") ? "video" : "audio",
        downloads,
      },
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape YouTube via ytmp3.gg.",
    };
  }
}

module.exports = { scrape };
