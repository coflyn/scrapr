const axios = require("axios");
const crypto = require("crypto");

const salt = "sn4pt1k_v3r1fy2026";
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest();
}

function decryptAes(id, encryptedBase64) {
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);

  const keySource = salt + ":" + id;
  const key = sha256(keySource);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

function solveChallenge(challenge) {
  switch (challenge.t) {
    case "b":
      return ((challenge.a ^ challenge.b) >> challenge.s) & 255;
    case "r":
      return challenge.n.reduce((m, f) => m + f, 0) * 2 + 1;
    case "c":
      return challenge.w.charCodeAt(challenge.i) * challenge.m;
    case "m":
      return ((challenge.a + challenge.b) % 100) * challenge.c;
    case "n":
      return challenge.a * challenge.b + challenge.b * challenge.c + challenge.c * challenge.a - challenge.a;
    default:
      throw new Error("Unknown challenge type: " + challenge.t);
  }
}

async function scrape(url) {
  try {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: "https://snaptik.app",
      headers: {
        "User-Agent": userAgent,
        Referer: "https://snaptik.app/",
        Origin: "https://snaptik.app",
      },
    });

    const resToken = await client.post(
      "/api/token",
      {},
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      },
    );

    if (!resToken.data || !resToken.data.id || !resToken.data.p) {
      throw new Error("Failed to retrieve token from SnapTik API.");
    }

    const { id, p } = resToken.data;
    const decryptedJson = decryptAes(id, p);
    const challenge = JSON.parse(decryptedJson);

    const _e = challenge._e;
    const _h = challenge._h;

    delete challenge._e;
    delete challenge._h;

    const challengeResult = solveChallenge(challenge);
    const xVerify = `${id}:${challengeResult}:${_e}:${_h}`;

    const resExtract = await client.get(
      `/api/extract?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-Verify": xVerify,
        },
      },
    );

    if (!resExtract.data || !resExtract.data.success || !resExtract.data.data) {
      throw new Error(
        resExtract.data.message || "Failed to extract download details from SnapTik API."
      );
    }

    const info = resExtract.data.data;
    const downloads = [];

    if (info.downloadUrl) {
      downloads.push({
        type: "mp4",
        quality: "Normal",
        url: info.downloadUrl,
      });
    }

    if (info.hdDownloadUrl) {
      // Build absolute HD URL
      const hdUrl = info.hdDownloadUrl.startsWith("http")
        ? info.hdDownloadUrl
        : "https://snaptik.app" + info.hdDownloadUrl;
      downloads.push({
        type: "mp4",
        quality: "HD",
        url: hdUrl,
      });
    }

    return {
      status: true,
      result: {
        title: info.title || "TikTok Video",
        thumbnail: info.thumbnail || "",
        type: info.type || "video",
        author: info.author || {},
        stats: info.stats || {},
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
