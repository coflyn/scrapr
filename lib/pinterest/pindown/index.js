const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");

async function scrape(url) {
  try {
    const cleanUrl = url.trim();
    const userAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

    const client = axios.create({
      baseURL: "https://pindown.io",
      headers: {
        "User-Agent": userAgent,
        Referer: "https://pindown.io/",
        Origin: "https://pindown.io",
      },
      timeout: 15000,
    });

    const { data: homeHtml, headers: homeHeaders } = await client.get("/");
    const $home = cheerio.load(homeHtml);

    const cfgVal =
      $home("input[data-challenge-config]").attr("value") ||
      $home("input[data-challenge-config]").val();
    let config = { seedParts: ["PinDown.io", ":browser:", "challenge:v1"], lang: "en" };
    if (cfgVal) {
      try {
        config = { ...config, ...JSON.parse(cfgVal) };
      } catch (_) {}
    }

    const homeCookies = (homeHeaders["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const { data: tokenData, headers: tokenHeaders } = await client.post(
      "/api/token",
      { url: cleanUrl },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Form-Language": config.lang || "en",
          "X-Requested-With": "XMLHttpRequest",
          Cookie: homeCookies,
        },
      }
    );

    const { id, p } = tokenData || {};
    if (!id || !p) {
      throw new Error("Could not acquire challenge token from pindown.io.");
    }

    const key = crypto
      .createHash("sha256")
      .update(config.seedParts.join("") + ":" + id)
      .digest();
    const bytes = Buffer.from(p, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, bytes.slice(0, 16));
    const challenge = JSON.parse(
      Buffer.concat([decipher.update(bytes.slice(16)), decipher.final()]).toString("utf8")
    );

    let answer;
    switch (challenge.t) {
      case "r":
        answer = challenge.n.reduce((s, n) => s + n, 0) * 2 + 1;
        break;
      case "b":
        answer = ((challenge.a ^ challenge.b) >> challenge.shift) & 255;
        break;
      case "c":
        answer = challenge.word.charCodeAt(challenge.index) * challenge.multiplier;
        break;
      case "m":
        answer = ((challenge.a + challenge.b) % 100) * challenge.multiplier;
        break;
      case "n":
        answer =
          challenge.a * challenge.b +
          challenge.b * challenge.c +
          challenge.c * challenge.a -
          challenge.a;
        break;
      default:
        throw new Error("Unknown challenge type from pindown.io.");
    }

    const verify = `${id}:${answer}:${challenge._e}:${challenge._h}`;
    const tokenCookies = (tokenHeaders["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const allCookies = [homeCookies, tokenCookies].filter(Boolean).join("; ");

    const formData = new URLSearchParams();
    formData.append("url", cleanUrl);
    formData.append("lang", config.lang || "en");

    const { data: actionData } = await client.post("/action", formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Verify": verify,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: allCookies,
      },
    });

    if (!actionData.success || !actionData.html) {
      throw new Error(actionData.message || "Failed to process pin on pindown.io.");
    }

    const $ = cheerio.load(actionData.html);
    const downloads = [];
    const seen = new Set();

    $("table tr").each((_, tr) => {
      const $tr = $(tr);
      const rowText = $tr.text().trim();
      const $btn = $tr.find("a[href^='http']").first();
      const dlUrl = $btn.attr("href");

      if (dlUrl && !seen.has(dlUrl)) {
        seen.add(dlUrl);
        const isVideo = rowText.toLowerCase().includes("video") || dlUrl.includes(".mp4");
        downloads.push({
          quality: rowText.replace(/download/i, "").trim() || (isVideo ? "720p" : "orig"),
          type: isVideo ? "video" : "image",
          url: dlUrl,
        });
      }
    });

    if (downloads.length === 0) {
      $("a[href^='http']").each((_, a) => {
        const href = $(a).attr("href");
        if (href && !href.includes("pindown.io") && !seen.has(href)) {
          seen.add(href);
          const isVideo = href.includes(".mp4");
          downloads.push({
            quality: isVideo ? "video" : "image",
            type: isVideo ? "video" : "image",
            url: href,
          });
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found from pindown.io.");
    }

    let thumbnail = "";
    try {
      const firstToken = downloads[0].url.split("token=")[1];
      if (firstToken) {
        const payloadJson = Buffer.from(firstToken.split(".")[1], "base64").toString("utf8");
        const payload = JSON.parse(payloadJson);
        thumbnail = payload.cover || "";
      }
    } catch (_) {}

    const title =
      $(".columns .column").first().find("h2, .title, p").first().text().trim() ||
      $(".columns .column").first().text().trim().split("\n")[0].trim() ||
      "Pinterest Media";

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: downloads.some((d) => d.type === "video") ? "video" : "image",
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
