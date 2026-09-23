const axios = require("axios");

const SAFARI_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";

async function scrape(url) {
  try {
    const cleanUrlMatch = url.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = cleanUrlMatch ? cleanUrlMatch[0].split("?")[0] : url.split("?")[0];

    const shortcodeMatch = cleanUrl.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (!shortcodeMatch) {
      throw new Error("Must be a valid Instagram post, reel, or TV URL.");
    }

    const shortcode = shortcodeMatch[1];
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

    const res = await axios.get(embedUrl, {
      headers: {
        "User-Agent": SAFARI_MOBILE_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
    });

    const htmlText = typeof res.data === "string" ? res.data : String(res.data);
    const unescaped = htmlText.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const idx = unescaped.indexOf('"shortcode_media":');
    if (idx === -1) {
      throw new Error("Could not find media in Instagram embed response.");
    }

    const start = idx + '"shortcode_media":'.length;
    let depth = 0;
    let end = -1;

    for (let i = start; i < unescaped.length; i++) {
      const char = unescaped[i];
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end === -1) {
      throw new Error("Failed to parse Instagram media JSON tree.");
    }

    const rawJson = unescaped.slice(start, end);
    const media = JSON.parse(rawJson);

    const caption =
      media.edge_media_to_caption?.edges?.[0]?.node?.text ||
      `Instagram ${media.is_video ? "Video" : "Photo"} (${shortcode})`;

    const downloads = [];

    if (media.edge_sidecar_to_children?.edges?.length) {
      media.edge_sidecar_to_children.edges.forEach((edge, i) => {
        const n = edge.node;
        const mediaUrl = n.video_url || n.display_url;
        if (mediaUrl) {
          downloads.push({
            type: n.is_video ? "video" : "image",
            quality: n.is_video ? "HD" : `Photo ${i + 1}`,
            url: mediaUrl,
          });
        }
      });
    } else {
      const mediaUrl = media.video_url || media.display_url;
      if (mediaUrl) {
        downloads.push({
          type: media.is_video ? "video" : "image",
          quality: "HD",
          url: mediaUrl,
        });
      }
    }

    if (downloads.length === 0) {
      throw new Error("No download links found from Instagram media.");
    }

    const thumbnail = media.display_url || downloads[0].url;

    return {
      status: true,
      result: {
        title: caption.slice(0, 90),
        thumbnail,
        type: media.is_video ? "video" : "image",
        author: {
          name: media.owner?.full_name || media.owner?.username || "Instagram Creator",
          username: media.owner?.username ? `@${media.owner.username}` : "",
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
