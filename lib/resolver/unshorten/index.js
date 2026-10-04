const axios = require("axios");

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

async function scrape(url, options = {}) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const initialUrl = extractCleanUrl(url);
    const autoResolve = options.autoResolve !== false;

    let currentUrl = initialUrl;
    const visited = new Set();
    const hops = [currentUrl];
    const maxHops = 10;

    for (let i = 0; i < maxHops; i++) {
      if (visited.has(currentUrl)) break;
      visited.add(currentUrl);

      const res = await axios({
        url: currentUrl,
        method: "GET",
        headers: {
          "User-Agent": DEFAULT_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 10000,
      });

      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, currentUrl).href;
        currentUrl = nextUrl;
        hops.push(currentUrl);
        continue;
      }

      const html = typeof res.data === "string" ? res.data : "";
      const metaRefresh = html.match(
        /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i,
      );
      if (metaRefresh && metaRefresh[1]) {
        const nextUrl = new URL(metaRefresh[1].trim(), currentUrl).href;
        currentUrl = nextUrl;
        hops.push(currentUrl);
        continue;
      }

      break;
    }

    if (autoResolve) {
      if (/https?:\/\/(?:www\.)?mediafire\.com\//i.test(currentUrl)) {
        const mediafire = require("../mediafire");
        const mfRes = await mediafire.scrape(currentUrl);
        if (mfRes.status && mfRes.result) {
          return {
            status: true,
            result: {
              ...mfRes.result,
              originalUrl: initialUrl,
              destinationUrl: currentUrl,
              hops,
            },
          };
        }
      }

      if (/https?:\/\/(?:www\.)?sfile\.(?:co|mobi)\//i.test(currentUrl)) {
        const sfile = require("../sfile");
        const sfileRes = await sfile.scrape(currentUrl);
        if (sfileRes.status && sfileRes.result) {
          return {
            status: true,
            result: {
              ...sfileRes.result,
              originalUrl: initialUrl,
              destinationUrl: currentUrl,
              hops,
            },
          };
        }
      }
    }

    return {
      status: true,
      result: {
        title: "Unshortened URL",
        originalUrl: initialUrl,
        destinationUrl: currentUrl,
        url: currentUrl,
        hops,
        downloads: [
          {
            type: "link",
            quality: "Direct Link",
            url: currentUrl,
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
