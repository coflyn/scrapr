const axios = require("axios");
const cheerio = require("cheerio");

function decodeBase64Url(str) {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    return Buffer.from(base64, "base64").toString("utf8");
  } catch (_) {
    return null;
  }
}

async function scrape(url) {
  try {
    let cleanUrl = url.split("?")[0].trim();
    cleanUrl = cleanUrl.replace("threads.com", "threads.net");

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      Origin: "https://threadster.app",
      Referer: "https://threadster.app/",
    };

    const r1 = await axios.get("https://threadster.app/", { headers, timeout: 10000 });
    const cookies = r1.headers["set-cookie"];
    const cookieStr = cookies
      ? cookies.map((c) => c.split(";")[0]).join("; ")
      : "";

    const params = new URLSearchParams();
    params.append("url", cleanUrl);

    const response = await axios.post(
      "https://threadster.app/download",
      params.toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieStr,
        },
        timeout: 15000,
      },
    );

    const $ = cheerio.load(response.data);
    const downloads = [];
    let detectedThumb = "";

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && (href.includes("token=") || href.includes("acxcdn.com"))) {
        let finalUrl = href.startsWith("http") ? href : `https://threadster.app${href}`;
        let type = href.includes("/image") ? "image" : "video";

        try {
          const urlObj = new URL(finalUrl);
          const token = urlObj.searchParams.get("token");
          if (token) {
            const payloadPart = token.split(".")[1];
            if (payloadPart) {
              const decodedStr = decodeBase64Url(payloadPart);
              if (decodedStr) {
                const payload = JSON.parse(decodedStr);
                if (payload.url) {
                  const lowerUrl = payload.url.toLowerCase();
                  if (
                    lowerUrl.includes(".jpg") ||
                    lowerUrl.includes(".jpeg") ||
                    lowerUrl.includes(".png") ||
                    lowerUrl.includes(".webp") ||
                    href.includes("/image")
                  ) {
                    type = "image";
                  } else if (
                    lowerUrl.includes(".mp4") ||
                    lowerUrl.includes(".m3u8") ||
                    href.includes("/video")
                  ) {
                    type = "video";
                  }
                  if (
                    !detectedThumb &&
                    (type === "image" ||
                      lowerUrl.includes(".jpg") ||
                      lowerUrl.includes(".webp"))
                  ) {
                    detectedThumb = payload.url;
                  }
                }
              }
            }
          }
        } catch (_) {}

        if (!downloads.some((d) => d.url === finalUrl)) {
          downloads.push({ type, url: finalUrl });
        }
      }
    });

    if (downloads.length === 0) {
      const errorMsg =
        $(
          ".download_result_section .error__msg, .alert-danger, .alert-warning",
        )
          .first()
          .text()
          .trim() ||
        "No download links found. The post may be private, text-only, or removed.";
      throw new Error(errorMsg);
    }

    const captionEl = $(
      ".download__item__caption__text, .download__item__caption, .card-text, .post-text",
    ).first();
    let caption = captionEl ? captionEl.text().trim().replace(/\s+/g, " ") : "";
    if (
      /please enter a valid threads link/i.test(caption) ||
      caption.toLowerCase().includes("download")
    ) {
      caption = "";
    }

    const authorEl = $(
      ".download__item__user_info span, .download__item__user_info",
    ).first();
    let authorText = authorEl ? authorEl.text().trim() : "";
    const authorMatchFromHtml = authorText.match(/@([A-Za-z0-9_.-]+)/);
    const authorMatchFromUrl = url.match(
      /threads\.(?:net|com)\/@([A-Za-z0-9_.-]+)/i,
    );
    const username = authorMatchFromHtml
      ? authorMatchFromHtml[1].replace(/·$/, "")
      : authorMatchFromUrl
        ? authorMatchFromUrl[1]
        : "";

    let threadsTitle = "";
    if (username && caption) {
      threadsTitle = `@${username}: ${caption}`;
    } else if (caption) {
      threadsTitle = caption;
    } else if (username) {
      threadsTitle = `@${username} - Threads Post`;
    } else {
      threadsTitle = "Threads Media";
    }

    if (threadsTitle.length > 90) {
      threadsTitle = threadsTitle.substring(0, 87) + "...";
    }

    return {
      status: true,
      result: {
        title: threadsTitle,
        thumbnail:
          detectedThumb ||
          downloads.find((d) => d.type === "image")?.url ||
          "",
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
