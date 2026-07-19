const axios = require("axios");
const cheerio = require("cheerio");

const baseUrl = "https://ssstik.io";
const regexTiktokUrl =
  /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
const regexSsstikToken = /s_tt\s*=\s*'([^']+)'/;

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

const extractToken = async (client) => {
  try {
    let { data: html } = await client.get("/");
    let matchedToken = html.match(regexSsstikToken);
    if (matchedToken && matchedToken.length > 1) {
      return matchedToken[1];
    } else {
      throw new Error("Can't find session token on ssstik.");
    }
  } catch (error) {
    throw new Error(
      "Something went wrong while fetching token: " + error.message,
    );
  }
};

async function scrape(url) {
  try {
    if (!regexTiktokUrl.test(url)) {
      throw new Error("Must be a valid tiktok url.");
    }

    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: baseUrl,
      headers: {
        "User-Agent": userAgent,
        Referer: "https://ssstik.io/id",
        Origin: "https://ssstik.io",
      },
    });

    let token = await extractToken(client);

    const formData = new URLSearchParams();
    formData.append("id", url);
    formData.append("locale", "id");
    formData.append("tt", token);

    let { data: html } = await client.post("/abc?url=dl", formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "HX-Request": "true",
        "HX-Trigger": "submit",
        "HX-Target": "target",
      },
    });

    let $ = cheerio.load(html);

    if (
      $("div.math-inline").length > 0 ||
      html.includes("Please paste a valid link") ||
      html.includes("Error")
    ) {
      throw new Error("Invalid link or failed to fetch data.");
    }

    let title = $("p.maintext").text().trim() || $("h2").text().trim();
    let author = $("h2").text().trim();
    let avatarUrl = $("img.result_author").attr("src");

    let isPhoto = false;
    let downloads = [];

    if (
      $("ul.splide__list").length > 0 ||
      $("a.slide").length > 0 ||
      $("a.download_slide").length > 0
    ) {
      isPhoto = true;
      $("a.slide, a.download_slide").each((i, el) => {
        let href = $(el).attr("href");
        if (href) {
          downloads.push({ type: "photo", url: href });
        }
      });
      let musicUrl = $("a.music").attr("href");
      if (musicUrl) {
        downloads.push({ type: "music", url: musicUrl });
      }
    } else {
      $("a").each((i, el) => {
        let href = $(el).attr("href");
        let text = $(el).text().trim().toLowerCase();

        if (href && href !== "/" && !href.includes("snaptik")) {
          if (
            $(el).hasClass("without_watermark") ||
            text.includes("tanpa tanda air") ||
            text.includes("without watermark")
          ) {
            downloads.push({ type: "video", url: href });
          } else if (
            $(el).hasClass("music") ||
            text.includes("mp3") ||
            text.includes("music")
          ) {
            downloads.push({ type: "music", url: href });
          }
        }
      });
      if (downloads.length === 0) {
        $("a.pure-button").each((i, el) => {
          let href = $(el).attr("href");
          if (href && href.includes("dl=")) {
            downloads.push({ type: "video", url: href });
          }
        });
      }
    }

    return {
      status: true,
      result: {
        title: title || "TikTok Content",
        author: author || "Unknown",
        thumbnail: avatarUrl || "",
        type: isPhoto ? "photo" : "video",
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
