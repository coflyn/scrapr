const axios = require("axios");
const cheerio = require("cheerio");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

async function scrape(url) {
  try {
    const cleanUrl = url.replace(
      /https:\/\/(fixupx|fxtwitter|vxtwitter|nitter|twitter)\.com/g,
      "https://x.com",
    );

    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: "https://tweeload.com",
      headers: {
        "User-Agent": userAgent,
        Referer: "https://tweeload.com/",
      },
    });

    const response1 = await client.get("/en");
    const cookies = response1.headers["set-cookie"];
    const cookieHeader = cookies
      ? cookies.map((c) => c.split(";")[0]).join("; ")
      : "";

    const params = new URLSearchParams();
    params.append("url", cleanUrl);

    const { data: html } = await client.post(
      "/en/download",
      params.toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const $ = cheerio.load(html);
    const downloads = [];

    const name = $(".download__item__info__user__name").first().text().trim();
    const handle = $(".download__item__info__user__handle")
      .first()
      .text()
      .trim();

    let mediaType = "video";
    $(".download__item__info__actions tbody tr").each((i, el) => {
      const $tds = $(el).find("td");
      const quality = $tds.eq(0).text().trim();
      const downloadUrl = $(el)
        .find("a.download__item__info__actions__button")
        .attr("href");

      if (downloadUrl) {
        if (downloadUrl.includes("/image?")) mediaType = "image";
        downloads.push({
          quality,
          url: downloadUrl,
        });
      }
    });

    if (downloads.length === 0) {
      $("a.btn").each((i, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("downloads.acxcdn.com")) {
          const text = $(el).text().trim();
          if (text.toLowerCase() !== "download via the mobile app") {
            if (href.includes("/image?")) mediaType = "image";
            downloads.push({
              quality: text || "Download",
              url: href,
            });
          }
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error(
        "Failed to extract download links. The tweet might be private or invalid.",
      );
    }

    return {
      status: true,
      result: {
        type: mediaType,
        user: {
          name: name || "Twitter User",
          handle: handle || "@",
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
