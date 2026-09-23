const axios = require("axios");
const cheerio = require("cheerio");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

async function scrape(url) {
  try {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: "https://pindown.io",
      headers: {
        "User-Agent": userAgent,
        Referer: "https://pindown.io/",
        Origin: "https://pindown.io",
      },
      timeout: 10000,
    });

    const { data: homeHtml, headers: homeHeaders } = await client.get("/");
    const $home = cheerio.load(homeHtml);

    const tokenInput = $home('input[type="hidden"]').not('[name="lang"]');
    const tokenName = tokenInput.attr("name");
    const tokenValue = tokenInput.attr("value");

    if (!tokenName || !tokenValue) {
      throw new Error("Could not extract verification token from pindown.io.");
    }

    const cookies = homeHeaders["set-cookie"];
    const cookieHeader = cookies ? cookies.map((c) => c.split(";")[0]).join("; ") : "";

    const formData = new URLSearchParams();
    formData.append("url", url);
    formData.append(tokenName, tokenValue);
    formData.append("lang", "en");

    const { data: actionData } = await client.post("/action", formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
      },
    });

    if (!actionData.success || !actionData.html) {
      throw new Error(actionData.message || "Failed to process pin on pindown.io.");
    }

    const $ = cheerio.load(actionData.html);
    const downloads = [];

    $(".columns .column").each((i, el) => {
      const $el = $(el);
      const title = $el.find(".is-size-6").text().trim();
      const $btn = $el.find(".button");
      let downloadUrl = $btn.attr("href");

      if (downloadUrl) {
        downloads.push({
          quality: title || "Download",
          type: downloadUrl.includes(".mp4") ? "video" : "image",
          url: downloadUrl,
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download links found from pindown.io.");
    }

    return {
      status: true,
      result: {
        title: "Pinterest Media",
        thumbnail: downloads[0]?.url || "",
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
