const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];
    const twitterUrl = cleanUrl.replace(
      /https:\/\/(?:x|fixupx|fxtwitter|vxtwitter|nitter)\.com/g,
      "https://twitter.com"
    );

    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

    const r1 = await axios.get("https://savetwt.com/", {
      headers: { "User-Agent": ua },
      timeout: 10000,
    });
    const cookies1 = (r1.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    const $1 = cheerio.load(r1.data);
    const csrf = $1('input[name="_token"]').val();

    if (!csrf) {
      throw new Error("Could not extract CSRF token from SaveTWT.");
    }

    const { data: postJson, headers: postHeaders } = await axios.post(
      "https://savetwt.com/download",
      new URLSearchParams({
        _token: csrf,
        return_locale: "en",
        url: twitterUrl,
      }).toString(),
      {
        headers: {
          Cookie: cookies1,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": ua,
          Referer: "https://savetwt.com/",
          Origin: "https://savetwt.com",
        },
        timeout: 15000,
      }
    );

    if (!postJson || !postJson.redirect) {
      throw new Error(postJson?.message || "SaveTWT did not return a valid download redirect.");
    }

    let redirectUrl = postJson.redirect;
    if (redirectUrl.startsWith("/")) {
      redirectUrl = "https://savetwt.com" + redirectUrl;
    }

    const cookies2 = (postHeaders["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    const sessionCookies = [cookies1, cookies2].filter(Boolean).join("; ");

    const r3 = await axios.get(redirectUrl, {
      headers: {
        Cookie: sessionCookies || cookies1,
        "User-Agent": ua,
        Referer: "https://savetwt.com/",
      },
      timeout: 15000,
    });

    const $3 = cheerio.load(r3.data);
    const downloads = [];
    const seen = new Set();

    $3(".result__quality__table tr, table tr").each((_, tr) => {
      const quality = $3(tr).find(".result__quality").text().trim();
      const linkEl = $3(tr).find("a.result__download__button, a[href*='dl.savetwt.com'], a[href*='savetwt.com/d/'], a.btn").first();
      const dlUrl = linkEl.attr("href");

      if (dlUrl && dlUrl.startsWith("http") && !seen.has(dlUrl)) {
        seen.add(dlUrl);
        const label = quality || linkEl.attr("aria-label") || "720p";
        downloads.push({
          quality: label,
          type: "video",
          url: dlUrl,
        });
      }
    });

    if (downloads.length === 0) {
      $3("a[href*='dl.savetwt.com'], a[href*='/d/v1.']").each((_, a) => {
        const dlUrl = $3(a).attr("href");
        if (dlUrl && dlUrl.startsWith("http") && !seen.has(dlUrl)) {
          seen.add(dlUrl);
          const label = $3(a).attr("aria-label") || $3(a).text().trim() || "video";
          downloads.push({
            quality: label,
            type: "video",
            url: dlUrl,
          });
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found from SaveTWT.");
    }

    const title = $3(".tweet-text, .desc, h3").first().text().trim() || "Twitter Media";
    const thumbnail = $3(".result__thumbnail img, img").first().attr("src") || "";

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: "video",
        downloads,
      },
    };
  } catch (err) {
    return {
      status: false,
      message: err.response?.data?.message || err.message || "Failed to scrape Twitter via SaveTWT.",
    };
  }
}

module.exports = { scrape };
