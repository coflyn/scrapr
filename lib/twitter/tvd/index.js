const axios = require("axios");
const cheerio = require("cheerio");
const direct = require("../direct").scrape;

async function scrape(url) {
  try {
    const normalizedUrl = url.replace(
      /https:\/\/(x|fxtwitter|vxtwitter|nitter)\.com/g,
      "https://twitter.com",
    );

    const client = axios.create({
      baseURL: "https://twittervideodownloader.com",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://twittervideodownloader.com/",
      },
      timeout: 10000,
    });

    const res1 = await client.get("/");
    const $1 = cheerio.load(res1.data);
    const csrf = $1('input[name="csrfmiddlewaretoken"]').val();
    const gql = $1('input[name="gql"]').val();
    const cookies = res1.headers["set-cookie"]
      ? res1.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ")
      : "";

    if (!csrf) {
      throw new Error(
        "Could not find CSRF token. The site might be protected by Cloudflare.",
      );
    }

    const payload = new URLSearchParams();
    payload.append("tweet", normalizedUrl);
    payload.append("csrfmiddlewaretoken", csrf);
    payload.append("gql", gql || "");

    const { data: html } = await client.post(
      "/download",
      payload.toString(),
      {
        headers: {
          Cookie: cookies,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const $ = cheerio.load(html);
    const downloads = [];

    $(".card-body").each((i, el) => {
      const $card = $(el);
      const qualityText =
        $card.find(".card-text").text().trim() || "Quality unknown";

      $card.find("a.btn-download, a.btn").each((j, btn) => {
        const href = $(btn).attr("href");
        const btnText = $(btn).text().trim();
        if (href && href.startsWith("http")) {
          downloads.push({
            quality: btnText.includes(":")
              ? btnText
              : `${qualityText} (${btnText})`,
            url: href,
          });
        }
      });
    });

    if (downloads.length === 0) {
      $('a[href*="video.twimg.com"], a[href*="pbs.twimg.com"]').each(
        (i, el) => {
          const href = $(el).attr("href");
          if (href && href.startsWith("http")) {
            downloads.push({
              quality: $(el).text().trim() || "Download",
              url: href,
            });
          }
        },
      );
    }

    const uniqueDownloads = Array.from(
      new Set(downloads.map((d) => d.url)),
    ).map((dlUrl) => downloads.find((d) => d.url === dlUrl));

    if (uniqueDownloads.length === 0) {
      throw new Error(
        "No video links found. Ensure the link is public and contains a video.",
      );
    }

    return {
      status: true,
      result: {
        title: "Twitter Video",
        downloads: uniqueDownloads,
      },
    };
  } catch (error) {
    try {
      const fallback = await direct(url);
      if (fallback.status) return fallback;
    } catch (_) {}
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
