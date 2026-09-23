const axios = require("axios");

function extractVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function fetchOembed(videoId) {
  try {
    const res = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { timeout: 5000 }
    );
    return {
      title: res.data?.title || "YouTube Video",
      thumbnail: res.data?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (_) {
    return {
      title: "YouTube Video",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}

async function convertViaConvert1s(url, format, quality) {
  try {
    const headers = {
      Origin: "https://media.ytmp3.gg",
      Referer: "https://media.ytmp3.gg/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
    };

    const res = await axios.post(
      "https://hub.convert1s.com/api/download",
      {
        url,
        os: "macos",
        output: {
          type: format === "mp4" ? "video" : "audio",
          format,
          quality: quality || "720p",
        },
        audio: { bitrate: "128k" },
      },
      { headers, timeout: 10000 }
    );

    const conv = res.data;
    if (!conv || !conv.statusUrl) return null;

    let downloadUrl = null;
    let attempts = 0;
    while (!downloadUrl && attempts < 15) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await axios.get(conv.statusUrl, { headers, timeout: 5000 });
      attempts++;
      if (poll.data?.status === "completed" && poll.data?.downloadUrl) {
        downloadUrl = poll.data.downloadUrl;
        break;
      }
      if (poll.data?.status === "error" || poll.data?.status === "failed") break;
    }

    return downloadUrl
      ? {
          type: format === "mp3" ? "audio" : "video",
          quality: conv.selectedQuality || quality || "720p",
          url: downloadUrl,
        }
      : null;
  } catch (_) {
    return null;
  }
}

async function scrape(url, format = "mp4") {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const meta = await fetchOembed(videoId);
    const downloads = [];

    // 1. Try modern fast converter (convert1s / media.ytmp3.gg)
    const primary = await convertViaConvert1s(url, format, format === "mp3" ? "" : "720p");
    if (primary) downloads.push(primary);

    // 2. Fallback to legacy ytmp3.mobi if primary failed
    if (downloads.length === 0) {
      const client = axios.create({
        headers: {
          Origin: "https://ytmp3.mobi",
          Referer: "https://ytmp3.mobi/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      const { data: initData } = await client.get(
        "https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471"
      );
      if (initData?.convertURL) {
        const { data: convData } = await client.get(
          `${initData.convertURL}&v=${videoId}&f=${format}`
        );
        if (convData && !convData.error) {
          let progress = 0;
          let finalUrl = convData.downloadURL;
          let attempts = 0;
          while (progress < 3 && attempts < 10) {
            await new Promise((r) => setTimeout(r, 2000));
            const { data: progData } = await client.get(convData.progressURL);
            progress = progData?.progress ?? 0;
            if (progData?.downloadURL) finalUrl = progData.downloadURL;
            if (progress === 4) break;
            attempts++;
          }
          if (finalUrl && progress >= 3) {
            downloads.push({
              type: format === "mp3" ? "audio" : "video",
              quality: format === "mp3" ? "320kbps" : "720p",
              url: finalUrl.startsWith("//") ? `https:${finalUrl}` : finalUrl,
            });
          }
        }
      }
    }

    if (downloads.length === 0) {
      throw new Error("Unable to resolve YouTube download stream.");
    }

    return {
      status: true,
      result: {
        title: meta.title,
        thumbnail: meta.thumbnail,
        type: format === "mp3" ? "audio" : "video",
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

module.exports = { scrape, extractVideoId };
