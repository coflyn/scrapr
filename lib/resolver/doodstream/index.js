const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getRandomString(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Doodstream URL.");
    }

    const idMatch = url.match(
      /(?:dood(?:stream)?\.[a-z]+|ds2play\.[a-z]+|doods\.[a-z]+|playmogo\.[a-z]+)\/(?:[ed]|download)\/([a-zA-Z0-9]+)/i,
    );

    if (!idMatch) {
      throw new Error("Could not extract Doodstream video ID from URL.");
    }
    const videoId = idMatch[1];
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = urlObj.host || "dood.to";
    const embedUrl = `https://${host}/e/${videoId}`;

    let res;
    try {
      res = await axios.get(embedUrl, {
        headers: {
          "User-Agent": DEFAULT_UA,
          Referer: `https://${host}/`,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        timeout: 15000,
        maxRedirects: 5,
      });
    } catch (fetchErr) {
      if (
        fetchErr.response?.status === 403 ||
        fetchErr.response?.data?.includes?.("cf-mitigated") ||
        fetchErr.response?.data?.includes?.("challenges.cloudflare.com")
      ) {
        throw new Error(
          "Doodstream is currently protected by Cloudflare challenge.",
        );
      }
      throw fetchErr;
    }

    const html = res.data || "";
    if (
      html.includes("cf-mitigated") ||
      html.includes("challenges.cloudflare.com")
    ) {
      throw new Error(
        "Doodstream is currently protected by Cloudflare challenge.",
      );
    }

    if (html.includes("File not found") || html.includes("Video not found")) {
      throw new Error("Doodstream video not found or has been deleted.");
    }

    const $ = cheerio.load(html);
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $(".title").first().text().trim() ||
      $("title").text().replace("- DoodStream", "").trim() ||
      "Doodstream Video";

    const passMatch = html.match(/\/pass_md5\/([a-zA-Z0-9_\-\/]+)/);
    if (!passMatch) {
      throw new Error("Could not find pass_md5 token in Doodstream page.");
    }

    const tokenMatch = html.match(/\?token=([a-zA-Z0-9]+)/);
    const token = tokenMatch ? tokenMatch[1] : "";

    const passUrl = `https://${host}/pass_md5/${passMatch[1]}`;
    const passRes = await axios.get(passUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Referer: embedUrl,
      },
      timeout: 15000,
    });

    const rawDirectUrl = typeof passRes.data === "string" ? passRes.data.trim() : "";
    if (!rawDirectUrl || !rawDirectUrl.startsWith("http")) {
      throw new Error("Failed to retrieve playable URL from Doodstream pass endpoint.");
    }

    const finalUrl = `${rawDirectUrl}${getRandomString(10)}?token=${token}&expiry=${Date.now()}`;

    return {
      status: true,
      result: {
        title,
        type: "video",
        url: finalUrl,
        downloads: [
          {
            type: "video",
            quality: "Direct Stream (MP4)",
            url: finalUrl,
          },
        ],
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve Doodstream URL.",
    };
  }
}

module.exports = { scrape };
