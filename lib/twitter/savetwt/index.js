const axios = require("axios");
const cheerio = require("cheerio");
const direct = require("../direct").scrape;

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];
    const twitterUrl = cleanUrl.replace(
      /https:\/\/(?:fixupx|fxtwitter|vxtwitter|nitter)\.com/g,
      "https://x.com",
    );

    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

    const r1 = await axios.get("https://savetwt.com/", {
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 8000,
    });
    const cookies1 = (r1.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const $1 = cheerio.load(r1.data);
    const csrf =
      $1('input[name="_token"]').val() ||
      $1('meta[name="csrf-token"]').attr("content");

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
        timeout: 10000,
      },
    );

    if (!postJson || !postJson.redirect) {
      throw new Error(
        postJson?.message ||
          "SaveTWT did not return a valid download redirect.",
      );
    }

    let redirectUrl = postJson.redirect;
    if (redirectUrl.startsWith("/")) {
      redirectUrl = "https://savetwt.com" + redirectUrl;
    }

    const cookies2 = (postHeaders["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
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

    $3("table tr, .result__quality__table tr").each((_, tr) => {
      const btn = $3(tr).find(
        "a.result__download__button, a.btn, a[href*='dl.savetwt.com']",
      );
      const qualityEl = $3(tr).find(".result__quality");
      const href = btn.attr("href");
      if (href && href.startsWith("http")) {
        const quality =
          qualityEl.text().trim() || btn.text().trim() || "Download";
        downloads.push({
          quality,
          url: href,
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download links found from SaveTWT.");
    }

    return {
      status: true,
      result: {
        title: "Twitter Media",
        downloads,
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
