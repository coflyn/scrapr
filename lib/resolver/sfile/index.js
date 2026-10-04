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

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return "";
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  return headers
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookies(oldCookie, newCookie) {
  const map = new Map();
  const add = (str) => {
    if (!str) return;
    str.split(";").forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx !== -1) {
        map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    });
  };
  add(oldCookie);
  add(newCookie);
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const cleanUrl = extractCleanUrl(url);

    let cookie = "";
    const res1 = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    cookie = parseCookies(res1.headers["set-cookie"]);
    const $1 = cheerio.load(res1.data);

    let title =
      $1('meta[property="og:title"]').attr("content") ||
      $1("h1").first().text().trim() ||
      "Sfile Download";
    title = title.replace(/\s*-\s*Sfile\.co$/i, "").trim();

    let size = "";
    const desc = $1('meta[property="og:description"]').attr("content") || "";
    const sizeMatch = desc.match(/size\s+([0-9.]+\s*[KMGT]?B)/i);
    if (sizeMatch) {
      size = sizeMatch[1];
    } else {
      const rawText = $1("body").text();
      const matchText = rawText.match(/([0-9.]+\s*(?:KB|MB|GB|B))/i);
      if (matchText) size = matchText[1];
    }

    const downloadBtn = $1("#download, a[data-dw-url]");
    const dwUrl = downloadBtn.attr("data-dw-url");

    if (!dwUrl) {
      throw new Error("Could not find download gate link on Sfile page.");
    }

    const gateUrl = dwUrl.startsWith("http")
      ? dwUrl
      : new URL(dwUrl, cleanUrl).href;

    const res2 = await axios.get(gateUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: cleanUrl,
        Cookie: cookie,
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const newCookies = parseCookies(res2.headers["set-cookie"]);
    cookie = mergeCookies(cookie, newCookies);

    const html2 = typeof res2.data === "string" ? res2.data : "";
    if (html2.includes("download link for this file has expired")) {
      throw new Error("Sfile download session expired.");
    }

    let directUrl = "";

    const fileMatches = html2.match(
      /https?:\\?\/\\?\/download\d*\.sfile\.co\\?\/downloadfile\\?\/[^\s"']+/gi,
    );
    if (fileMatches && fileMatches.length > 0) {
      directUrl = fileMatches[0].replace(/\\/g, "");
    }

    if (!directUrl) {
      const directMatch = html2.match(
        /data-direct-download=["']([^"']+)["']/i,
      );
      if (directMatch) {
        directUrl = directMatch[1].replace(/&amp;/g, "&");
      }
    }

    if (!directUrl) {
      const $2 = cheerio.load(html2);
      directUrl = $2("#download").attr("href") || "";
      if (directUrl === "#" || !directUrl.startsWith("http")) {
        directUrl = "";
      }
    }

    if (!directUrl) {
      throw new Error("Could not extract final direct download URL from Sfile.");
    }

    return {
      status: true,
      result: {
        title,
        filename: title,
        size: size || "Unknown",
        url: directUrl,
        downloads: [
          {
            type: "file",
            quality: "Direct Download",
            url: directUrl,
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
