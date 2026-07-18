const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const cleanUrl = url.split("?")[0];
    const desktopUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const acceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

    const res1 = await axios.get("https://indown.io/en2", {
      headers: {
        "User-Agent": desktopUA,
        "Accept": acceptHeader,
      },
    });

    const cookies = res1.headers["set-cookie"]
      ? res1.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ")
      : "";
    const $ = cheerio.load(res1.data);
    const token = $('input[name="_token"]').val();

    if (!token) {
      throw new Error("Failed to get CSRF token from indown.io");
    }

    const payload = new URLSearchParams();
    payload.append("link", cleanUrl);
    payload.append("_token", token);
    payload.append("a", "a");

    const res2 = await axios.post(
      "https://indown.io/download",
      payload.toString(),
      {
        headers: {
          Cookie: cookies,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": desktopUA,
          "Accept": acceptHeader,
          Origin: "https://indown.io",
          Referer: "https://indown.io/en2",
        },
      }
    );

    const $2 = cheerio.load(res2.data);
    let downloads = [];
    let thumbnail = null;

    const errorMsg = $2("#error .modal-body").text().trim();
    if (errorMsg && errorMsg.toLowerCase().includes("not found")) {
      throw new Error(errorMsg);
    }

    const videoPoster = $2("video.img-fluid").attr("poster");
    if (videoPoster) {
      thumbnail = videoPoster;
    }

    $2(".btn-group-vertical a").each((i, el) => {
      const href = $2(el).attr("href");
      if (href && href.startsWith("http")) {
        const text = $2(el).text().trim().toUpperCase();
        const type = text.includes("PHOTO") || text.includes("IMAGE") ? "image" : "video";
        if (!downloads.some((d) => d.url === href)) {
          downloads.push({ type, url: href });
        }
      }
    });

    if (downloads.length === 0) {
      const resultArea = $2(".container .row").length ? $2(".container .row") : $2("body");
      resultArea.find("a").each((i, el) => {
        const href = $2(el).attr("href");
        if (
          href &&
          href.startsWith("http") &&
          !href.includes("indown.io") &&
          !href.includes("ads")
        ) {
          const text = $2(el).text().trim().toUpperCase();
          const type = text.includes("PHOTO") || text.includes("IMAGE") ? "image" : "video";
          if (!downloads.some((d) => d.url === href)) {
            downloads.push({ type, url: href });
          }
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error(
        "No media links found. The post might be private or unavailable."
      );
    }

    const title =
      $2("h5")
        .first()
        .text()
        .trim()
        .replace(/[^\w\s-]/gi, "") || "Instagram_Content";

    return {
      status: true,
      result: {
        title,
        thumbnail,
        downloads,
      },
    };
  } catch (e) {
    return {
      status: false,
      message: e.message,
    };
  }
}

module.exports = { scrape };
