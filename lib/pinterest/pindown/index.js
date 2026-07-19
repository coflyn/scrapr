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
      withCredentials: true,
    });

    const { data: homeHtml, headers: homeHeaders } = await client.get("/");
    const $home = cheerio.load(homeHtml);

    const tokenInput = $home('input[type="hidden"]').not('[name="lang"]');
    const tokenName = tokenInput.attr("name");
    const tokenValue = tokenInput.attr("value");

    if (!tokenName || !tokenValue) {
      throw new Error("Could not find session token on pindown.io");
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
      throw new Error(actionData.message || "Failed to fetch download links from pindown.io");
    }

    const $ = cheerio.load(actionData.html);
    const downloads = [];

    $(".columns .column").each((i, el) => {
      const $el = $(el);
      const title = $el.find(".is-size-6").text().trim();
      const $btn = $el.find(".button");
      let downloadUrl = $btn.attr("href");
      const isApi = $btn.attr("onclick") && $btn.attr("onclick").includes("fetchVideoUrl");

      if (isApi) {
        const match = $btn.attr("onclick").match(/'([^']+)'/);
        if (match) {
          downloadUrl = "https://pindown.io" + match[1];
        }
      }

      if (downloadUrl) {
        downloads.push({
          quality: title || "High Quality",
          url: downloadUrl,
          isApi: !!isApi,
          type: downloadUrl.includes(".mp3") ? "audio" : downloadUrl.includes(".png") || downloadUrl.includes(".jpg") ? "image" : "video",
        });
      }
    });

    for (let dl of downloads) {
      if (dl.isApi) {
        try {
          const { data: apiData } = await client.get(dl.url, {
            headers: { Cookie: cookieHeader },
          });
          if (apiData.success && apiData.url) {
            dl.url = apiData.url;
          }
        } catch (e) {
          console.error("Failed to resolve API URL:", dl.url);
        }
        delete dl.isApi;
      }
    }

    const title = $("h3").first().text().trim() || "Pinterest Content";
    const thumbnail = $(".image img").attr("src") || "";

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
