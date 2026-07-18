const axios = require("axios");

function extractVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function scrape(url, format = "mp4") {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const client = axios.create({
      headers: {
        Origin: "https://ytmp3.mobi",
        Referer: "https://ytmp3.mobi/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const { data: initData } = await client.get(
      "https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471",
    );
    if (initData.error) throw new Error("Init failed: " + initData.error);
    const convertURL = initData.convertURL;

    const { data: convData } = await client.get(
      `${convertURL}&v=${videoId}&f=${format}`,
    );
    if (convData.error) throw new Error("Conversion failed: " + convData.error);

    const { progressURL, downloadURL, title } = convData;

    let progress = 0;
    let finalDownloadURL = downloadURL;

    while (progress < 3) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data: progData } = await client.get(progressURL);

      if (progData.error)
        throw new Error("Progress check failed: " + progData.error);

      progress = progData.progress;
      if (progData.downloadURL) finalDownloadURL = progData.downloadURL;

      if (progress === 4) break;
    }

    if (progress === 4) throw new Error("Conversion error on server side.");

    return {
      status: true,
      result: {
        title: title || "YouTube Video",
        downloads: [
          {
            type: format === "mp3" ? "audio" : "video",
            quality: format === "mp3" ? "320kbps" : "720p",
            url: finalDownloadURL
          }
        ]
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
