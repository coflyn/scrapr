const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

async function scrape(url) {
  try {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: "https://snaptik.app",
      headers: {
        "User-Agent": userAgent,
        Referer: "https://snaptik.app/",
        Origin: "https://snaptik.app",
      },
    });

    const { data: mainPage } = await client.get("/");
    const $main = cheerio.load(mainPage);
    const token = $main('input[name="token"]').val();

    if (!token) {
      throw new Error("Could not find session token on SnapTik.");
    }

    const form = new FormData();
    form.append("token", token);
    form.append("url", url);

    const { data: script1 } = await client.post("/abc2.php", form, {
      headers: {
        ...form.getHeaders(),
        Accept: "*/*",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
      },
    });

    if (!script1 || !script1.includes("eval")) {
      throw new Error(
        "SnapTik returned an invalid response. It might be blocking the request.",
      );
    }

    const script2 = await new Promise((resolve) => {
      const mockEval = (s) => resolve(s);
      const fn = new Function("eval", script1);
      fn(mockEval);
    });

    const { html } = await new Promise((resolve, reject) => {
      let capturedHtml = "";
      const context = {
        $: () => ({
          remove: () => {},
          style: { display: "" },
          set innerHTML(t) {
            capturedHtml = t;
          },
        }),
        app: {
          showAlert: (msg) => reject(new Error(msg)),
        },
        document: {
          getElementById: () => ({ src: "" }),
        },
        fetch: (oembed_url) => {
          resolve({ html: capturedHtml, oembed_url });
          return {
            json: () => Promise.resolve({ thumbnail_url: "" }),
          };
        },
        gtag: () => {},
        Math: { round: () => 0 },
        XMLHttpRequest: function () {
          return { open: () => {}, send: () => {} };
        },
        window: {
          location: { hostname: "snaptik.app" },
        },
        setTimeout: () => {},
        setInterval: () => {},
        console: { log: () => {} },
      };

      try {
        const keys = Object.keys(context);
        const values = Object.values(context);
        const fn = new Function(...keys, script2);
        fn(...values);

        setTimeout(() => resolve({ html: capturedHtml }), 500);
      } catch (e) {
        reject(e);
      }
    });

    if (!html || html.length < 100) {
      throw new Error("Failed to parse download data from SnapTik.");
    }

    const $ = cheerio.load(html);
    const downloads = [];
    let isPhoto = false;

    $("a").each((i, el) => {
      const $el = $(el);
      let link = $el.attr("href");
      const text = $el.text().trim();

      if (!link) return;

      if (link.startsWith("/abc2.php")) {
        link = "https://snaptik.app" + link;
      }

      if (
        link.startsWith("http") &&
        !link.includes("facebook.com") &&
        !link.includes("twitter.com") &&
        !link.includes("instagram.com")
      ) {
        const type =
          text.replace("Download", "").trim() ||
          `Server ${downloads.length + 1}`;
        if (type.toLowerCase().includes("photo")) {
          isPhoto = true;
        }
        downloads.push({ type, url: link });
      }
    });

    const title =
      $(".video-title").text().trim() || $(".video-center h3").text().trim();
    const thumbnail =
      $("#thumbnail").attr("src") || $(".video-center img").attr("src");

    return {
      status: true,
      result: {
        title: title || "TikTok Content",
        thumbnail,
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
