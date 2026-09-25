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

async function resolveCanonicalUrl(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
      },
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 400,
      timeout: 10000,
    });
    if (res.headers.location) {
      return res.headers.location;
    }
  } catch (e) {
    if (e.response?.headers?.location) {
      return e.response.headers.location;
    }
  }
  return url;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const cleanUrl = extractCleanUrl(url);

    // Resolve shortlink (reddit.com/r/.../s/...) to full canonical post URL
    let targetUrl = cleanUrl;
    if (cleanUrl.includes("/s/")) {
      targetUrl = await resolveCanonicalUrl(cleanUrl);
    }

    const rapidUrl = `https://rapidsave.com/info?url=${encodeURIComponent(targetUrl)}`;
    const res = await axios.get(rapidUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Referer: "https://rapidsave.com/",
      },
      timeout: 15000,
    });

    const html = typeof res.data === "string" ? res.data : "";

    // Extract download button link
    const dlMatch =
      html.match(/class="downloadbutton"[^>]*href="([^"]+)"/i) ||
      html.match(/href="([^"]*sd\.rapidsave\.com\/download\.php[^"]*)"/i) ||
      html.match(/href="([^"]*download[^"]*)"/i);

    if (!dlMatch) {
      if (html.includes("alert-info") && html.includes("Reddit is limiting")) {
        throw new Error("Reddit is limiting upstream access on RapidSave.");
      }
      throw new Error("Could not extract video download link from RapidSave.");
    }

    // Extract title
    let title = "Reddit Video";
    const titleMatch =
      html.match(/class="text-center">([^<]+)<\/p>/i) ||
      html.match(/<h2>([\s\S]*?)<\/h2>/i) ||
      html.match(/<strong>([\s\S]*?)<\/strong>/i);

    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    } else {
      const slugMatch = targetUrl.match(/comments\/[^\/]+\/([^\/\?#]+)/);
      if (slugMatch && slugMatch[1]) {
        title = decodeURIComponent(slugMatch[1].replace(/_/g, " "));
      }
    }

    // Extract thumbnail
    const thumbMatch = html.match(/<img[^>]+src="([^">]*thumbs\.rapidsave\.com[^">]*)"/i);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";

    const videoUrl = dlMatch[1].replace(/&amp;/g, "&");

    // Extract standalone audio stream if present in params
    let audioUrl = null;
    try {
      const parsed = new URL(videoUrl);
      const audioParam = parsed.searchParams.get("audio_url");
      if (audioParam && audioParam.startsWith("http")) {
        audioUrl = audioParam;
      }
    } catch (_) {}

    const downloads = [
      {
        type: "video",
        quality: "HD Video (with Audio)",
        url: videoUrl,
      },
    ];

    if (audioUrl) {
      downloads.push({
        type: "audio",
        quality: "Audio Track",
        url: audioUrl,
      });
    }

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: "video",
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
