const axios = require("axios");

async function scrape(url) {
  try {
    const idMatch = url.match(/status(?:es)?\/(\d+)/i);
    if (!idMatch) {
      throw new Error("Must be a valid Twitter/X post URL.");
    }

    const tweetId = idMatch[1];
    const res = await axios.get(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    });

    if (res.data?.code !== 200 || !res.data?.tweet) {
      throw new Error(res.data?.message || "Failed to fetch tweet details.");
    }

    const tweet = res.data.tweet;
    const author = tweet.author?.name || tweet.author?.screen_name || "Twitter User";
    const text = tweet.text || "";
    const title = text.replace(/https:\/\/t\.co\/\S+/g, "").trim() || `${author}'s Tweet`;

    const downloads = [];

    if (tweet.media?.videos?.length) {
      tweet.media.videos.forEach((v) => {
        downloads.push({
          type: "video",
          quality: `${v.width || ""}x${v.height || ""}`.trim() || "HD",
          url: v.url,
        });
      });
    }

    if (tweet.media?.photos?.length) {
      tweet.media.photos.forEach((p, idx) => {
        downloads.push({
          type: "image",
          quality: `Photo ${idx + 1}`,
          url: p.url,
        });
      });
    }

    if (downloads.length === 0 && tweet.media?.all?.length) {
      tweet.media.all.forEach((m, idx) => {
        downloads.push({
          type: m.type === "photo" ? "image" : "video",
          quality: `Media ${idx + 1}`,
          url: m.url,
        });
      });
    }

    if (downloads.length === 0) {
      throw new Error("No media found in this tweet.");
    }

    const thumbnail =
      tweet.media?.videos?.[0]?.thumbnail_url ||
      tweet.media?.photos?.[0]?.url ||
      downloads[0].url;

    return {
      status: true,
      result: {
        title: title.slice(0, 90),
        thumbnail,
        type: downloads.some((d) => d.type === "video") ? "video" : "image",
        author: {
          name: author,
          username: tweet.author?.screen_name ? `@${tweet.author.screen_name}` : "",
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
