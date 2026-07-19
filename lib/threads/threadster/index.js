const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      Origin: "https://threadster.app",
      Referer: "https://threadster.app/",
    };

    const r1 = await axios.get("https://threadster.app/", { headers });
    const cookies = r1.headers["set-cookie"];
    const cookieStr = cookies
      ? cookies.map((c) => c.split(";")[0]).join("; ")
      : "";

    const params = new URLSearchParams();
    params.append("url", url);

    const response = await axios.post(
      "https://threadster.app/download",
      params.toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieStr,
        },
      },
    );

    const $ = cheerio.load(response.data);
    const downloads = [];

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && (href.includes("token=") || href.includes("acxcdn.com"))) {
        let finalUrl = href;
        let type = "video";

        try {
          const urlObj = new URL(href);
          const token = urlObj.searchParams.get("token");
          if (token) {
            const payloadPart = token.split(".")[1];
            if (payloadPart) {
              const payload = JSON.parse(
                Buffer.from(payloadPart, "base64").toString(),
              );
              if (payload.url) {
                finalUrl = payload.url;
                const lowerUrl = finalUrl.toLowerCase();
                if (
                  lowerUrl.includes(".jpg") ||
                  lowerUrl.includes(".jpeg") ||
                  lowerUrl.includes(".png") ||
                  lowerUrl.includes(".webp")
                ) {
                  type = "image";
                } else {
                  type = "video";
                }
              }
            }
          }
        } catch (e) {}

        downloads.push({ type, url: finalUrl });
      }
    });

    if (downloads.length === 0) {
      throw new Error(
        "No download links found. The post might be private or invalid.",
      );
    }

    return {
      status: true,
      result: {
        title: "Threads Media",
        thumbnail: downloads.find((d) => d.type === "image")?.url || "",
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
