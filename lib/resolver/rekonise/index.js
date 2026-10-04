const axios = require("axios");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractSlug(input) {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();
  const match = clean.match(/rekonise\.com\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  clean = clean.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return clean.split("/").pop() || clean;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrape(url, options = {}) {
  try {
    if (!url || typeof url !== "string") throw new Error("Invalid URL.");
    const slug = extractSlug(url);
    if (!slug) throw new Error("Could not extract Rekonise slug from URL.");

    const autoResolve = options.autoResolve !== false;
    const pageUrl = `https://rekonise.com/${slug}`;

    const headers = {
      "User-Agent": DEFAULT_UA,
      Origin: "https://rekonise.com",
      Referer: pageUrl,
      Accept: "application/json, text/plain, */*",
    };

    const infoRes = await axios.get(
      `https://api.rekonise.com/social-unlocks/${slug}`,
      { headers, timeout: 15000 },
    );

    const data = infoRes.data;
    if (!data || !data.unlock_token) {
      throw new Error("Invalid response or missing unlock token from Rekonise API.");
    }

    const title = data.title || "Rekonise Unlock";
    const token = data.unlock_token;
    const actions = Array.isArray(data.actions) ? data.actions : [];

    for (const a of actions) {
      if (a.type && a.value) {
        try {
          await axios.post(
            "https://api.rekonise.com/traffic/action-completed",
            {
              actionType: a.type,
              actionValue: a.value,
              slug,
            },
            { headers, timeout: 10000 },
          );
        } catch {}
      }
    }

    let waitMs = 11000;
    try {
      const parts = token.split(".");
      if (parts.length > 1) {
        const payload = JSON.parse(
          Buffer.from(parts[0], "base64").toString("utf-8"),
        );
        if (payload.issuedAt) {
          const elapsed = Date.now() - payload.issuedAt;
          waitMs = Math.max(0, 11000 - elapsed);
        }
      }
    } catch {}

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const unlockRes = await axios.get(
      `https://api.rekonise.com/social-unlocks/${slug}/unlock?token=${encodeURIComponent(
        token,
      )}`,
      { headers, timeout: 15000 },
    );

    const destUrl = unlockRes.data?.url;
    if (!destUrl) {
      throw new Error("Could not retrieve destination URL from Rekonise.");
    }

    if (autoResolve) {
      if (/https?:\/\/(?:www\.)?mediafire\.com\//i.test(destUrl)) {
        const mediafire = require("../mediafire");
        const mfRes = await mediafire.scrape(destUrl);
        if (mfRes.status && mfRes.result) {
          return {
            status: true,
            result: {
              ...mfRes.result,
              originalUrl: pageUrl,
              destinationUrl: destUrl,
            },
          };
        }
      }

      if (/https?:\/\/(?:www\.)?sfile\.(?:co|mobi)\//i.test(destUrl)) {
        const sfile = require("../sfile");
        const sfileRes = await sfile.scrape(destUrl);
        if (sfileRes.status && sfileRes.result) {
          return {
            status: true,
            result: {
              ...sfileRes.result,
              originalUrl: pageUrl,
              destinationUrl: destUrl,
            },
          };
        }
      }
    }

    return {
      status: true,
      result: {
        title,
        originalUrl: pageUrl,
        destinationUrl: destUrl,
        url: destUrl,
        downloads: [
          {
            type: "link",
            quality: "Direct Link",
            url: destUrl,
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
