const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractCleanUrl(text) {
  if (!text || typeof text !== "string") return "";
  const match = text.match(/https?:\/\/[^\s]+/i);
  let clean = match ? match[0] : text.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  return clean;
}

function extractUnlockedLink(html) {
  const $ = cheerio.load(html);

  const nextDataScript = $("#__NEXT_DATA__").html();
  if (nextDataScript) {
    try {
      const parsed = JSON.parse(nextDataScript);
      const sinkData = parsed?.props?.pageProps?.sink?.data;
      if (sinkData?.unlocked_link) {
        return {
          title: sinkData.title || "Sub2Unlock Link",
          unlockedUrl: sinkData.unlocked_link,
          description: sinkData.description || "",
        };
      }
    } catch {}
  }

  const rawMatch = html.match(
    /["'](?:unlocked_link|destination|target_link|unlockedUrl)["']\s*:\s*["'](https?:\/\/[^"']+)["']/i,
  );
  if (rawMatch) {
    return {
      title: $("title").text().trim() || "Sub2Unlock Link",
      unlockedUrl: rawMatch[1].replace(/\\\//g, "/"),
      description: "",
    };
  }

  const atobMatch = html.match(/atob\(["']([A-Za-z0-9+/=]{16,})["']\)/);
  if (atobMatch) {
    try {
      const decoded = Buffer.from(atobMatch[1], "base64").toString("utf-8");
      if (/^https?:\/\//i.test(decoded)) {
        return {
          title: $("title").text().trim() || "Sub2Unlock Link",
          unlockedUrl: decoded,
          description: "",
        };
      }
    } catch {}
  }

  const btnLink = $(
    "a#btn-download, a.unlocked-btn, a[href*='mediafire.com'], a[href*='drive.google.com']",
  ).attr("href");
  if (btnLink && /^https?:\/\//i.test(btnLink)) {
    return {
      title: $("title").text().trim() || "Sub2Unlock Link",
      unlockedUrl: btnLink,
      description: "",
    };
  }

  return null;
}

async function scrape(url, options = {}) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const cleanUrl = extractCleanUrl(url);
    const autoResolve = options.autoResolve !== false;

    const res = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = typeof res.data === "string" ? res.data : "";
    const extracted = extractUnlockedLink(html);

    if (!extracted || !extracted.unlockedUrl) {
      throw new Error("Could not find unlocked target link on Sub2Unlock page.");
    }

    const destinationUrl = extracted.unlockedUrl;

    if (autoResolve) {
      if (/https?:\/\/(?:www\.)?mediafire\.com\//i.test(destinationUrl)) {
        const mediafire = require("../mediafire");
        const mfRes = await mediafire.scrape(destinationUrl);
        if (mfRes.status && mfRes.result) {
          return {
            status: true,
            result: {
              ...mfRes.result,
              originalUrl: cleanUrl,
              destinationUrl,
            },
          };
        }
      }

      if (/https?:\/\/(?:www\.)?sfile\.(?:co|mobi)\//i.test(destinationUrl)) {
        const sfile = require("../sfile");
        const sfileRes = await sfile.scrape(destinationUrl);
        if (sfileRes.status && sfileRes.result) {
          return {
            status: true,
            result: {
              ...sfileRes.result,
              originalUrl: cleanUrl,
              destinationUrl,
            },
          };
        }
      }
    }

    return {
      status: true,
      result: {
        title: extracted.title,
        originalUrl: cleanUrl,
        destinationUrl,
        url: destinationUrl,
        downloads: [
          {
            type: "link",
            quality: "Direct Link",
            url: destinationUrl,
          },
        ],
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
