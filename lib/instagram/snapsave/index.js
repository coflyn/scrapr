const axios = require("axios");
const cheerio = require("cheerio");

function extractHtmlFromScript(str) {
  if (typeof str !== "string") return "";
  let matched = "";
  const idxDouble = str.indexOf('innerHTML = "');
  if (idxDouble !== -1) {
    const start = idxDouble + 'innerHTML = "'.length;
    const lastQuote = str.lastIndexOf('";');
    const end = lastQuote !== -1 ? lastQuote : str.lastIndexOf('"');
    if (end > start) {
      const rawString = str.slice(start, end);
      try {
        matched = (0, eval)('"' + rawString + '"');
      } catch (_) {
        matched = rawString.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
  }
  if (!matched) {
    const idxSingle = str.indexOf("innerHTML = '");
    if (idxSingle !== -1) {
      const start = idxSingle + "innerHTML = '".length;
      const lastQuote = str.lastIndexOf("';");
      const end = lastQuote !== -1 ? lastQuote : str.lastIndexOf("'");
      if (end > start) {
        const rawString = str.slice(start, end);
        try {
          matched = (0, eval)("'" + rawString + "'");
        } catch (_) {
          matched = rawString.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        }
      }
    }
  }
  return matched;
}

function cleanUrlString(input) {
  if (!input) return null;
  let raw = input.trim().replace(/^["'\\]+|["'\\]+$/g, "");
  if (raw.startsWith("//")) raw = "https:" + raw;
  return raw.startsWith("http") ? raw : null;
}

function extractDirectMediaUrl(input) {
  const cleaned = cleanUrlString(input);
  if (!cleaned) return null;
  try {
    const match = cleaned.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
    if (match) {
      const payloadPart = match[1].split(".")[1];
      if (payloadPart) {
        const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
        if (payload && payload.url) return payload.url;
      }
    }
  } catch (_) {}
  return cleaned;
}

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://snapsave.app",
      Referer: "https://snapsave.app/",
    };

    const res = await axios.post(
      "https://snapsave.app/action.php",
      `url=${encodeURIComponent(cleanUrl)}`,
      { headers, timeout: 15000 }
    );

    let htmlContent = "";
    const rawData = res.data;

    if (typeof rawData === "string" && rawData.trim().startsWith("<")) {
      htmlContent = rawData;
    } else if (typeof rawData === "string") {
      try {
        const codeToRun = rawData.replace(/\beval\s*\(\s*function/g, "(function");
        const unpackedScript = (0, eval)(codeToRun);
        htmlContent =
          extractHtmlFromScript(unpackedScript) || extractHtmlFromScript(rawData);
      } catch (_) {
        htmlContent = extractHtmlFromScript(rawData);
      }
    }

    if (!htmlContent || typeof htmlContent !== "string") {
      throw new Error("Empty response from SnapSave.");
    }

    const $ = cheerio.load(htmlContent);
    const downloads = [];
    const seen = new Set();

    $(".download-items, .download-box, table tbody tr").each((_, item) => {
      const thumb =
        cleanUrlString($(item).find(".download-items__thumb img, .thumbnail img, img").first().attr("src")) ||
        "";

      $(item)
        .find(
          "a.abutton, .download-items__btn a, a[href*='rapidcdn'], a[href*='snapcdn'], a.btn-download, a[href^='http']"
        )
        .each((_, a) => {
          const rawHref = cleanUrlString($(a).attr("href"));
          if (!rawHref || rawHref.includes("snapsave.app") || rawHref.includes("play.google.com") || seen.has(rawHref))
            return;
          seen.add(rawHref);

          const btnText = $(a).text().trim().toLowerCase();
          const isPhoto =
            btnText.includes("photo") ||
            btnText.includes("image") ||
            rawHref.includes("/image");
          downloads.push({
            quality: isPhoto ? "photo" : "720p",
            type: isPhoto ? "photo" : "video",
            url: rawHref,
            thumbnail: thumb || undefined,
          });
        });

      $(item).find("select option").each((_, opt) => {
        const val = cleanUrlString($(opt).attr("value"));
        if (!val || val.includes("snapsave.app") || seen.has(val)) return;
        seen.add(val);

        const quality = $(opt).text().trim() || "HD";
        const isPhoto = quality.toLowerCase().includes("photo") || quality.toLowerCase().includes("image");
        downloads.push({
          quality: isPhoto ? "photo" : quality,
          type: isPhoto ? "photo" : "video",
          url: val,
          thumbnail: thumb || undefined,
        });
      });
    });

    if (downloads.length === 0) {
      $("a[href^='http'], a[href*='rapidcdn'], a[href*='snapcdn']").each((_, a) => {
        const href = cleanUrlString($(a).attr("href"));
        if (
          href &&
          !href.includes("snapsave.app") &&
          !href.includes("play.google.com") &&
          !seen.has(href)
        ) {
          seen.add(href);
          const isPhoto = href.includes("/image");
          downloads.push({
            quality: isPhoto ? "photo" : "HD",
            type: isPhoto ? "photo" : "video",
            url: href,
          });
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found from SnapSave.");
    }

    const title =
      $(".download-items__title, .card-title, .caption, h3").first().text().trim() ||
      "Instagram Media";
    const thumbnail =
      downloads[0].thumbnail || cleanUrlString($("img").first().attr("src")) || "";

    return {
      status: true,
      result: {
        title,
        thumbnail,
        type: downloads.some((d) => d.type === "photo") ? "photo" : "video",
        downloads,
      },
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape Instagram via SnapSave.",
    };
  }
}

module.exports = { scrape };
