const axios = require("axios");
const cheerio = require("cheerio");

function decodeSnapSave(data) {
  try {
    const regex =
      /eval\(function\(h,u,n,t,e,r\)\{.*?\}\("(.*?)",(\d+),"(.*?)",(\d+),(\d+),(\d+)\)\)/;
    const match = data.match(regex);

    if (match) {
      const h = match[1];
      const u = parseInt(match[2]);
      const n = match[3];
      const t = parseInt(match[4]);
      const e = parseInt(match[5]);

      const delimiter = n[e];
      const parts = h.split(delimiter);
      let decoded = "";

      for (let s of parts) {
        if (s === "") continue;

        let val = 0;
        for (let j = 0; j < s.length; j++) {
          val += n.indexOf(s[j]) * Math.pow(e, s.length - 1 - j);
        }

        decoded += String.fromCharCode(val - t);
      }

      return decodeURIComponent(escape(decoded));
    }
    return data;
  } catch (err) {
    return data;
  }
}

function extractFinalUrl(input) {
  if (!input) return null;
  let raw = input.trim().replace(/^["'\\]+|["'\\]+$/g, "");
  if (raw.includes(".") && !raw.startsWith("http")) {
    try {
      const payloadPart = raw.split(".")[1];
      if (payloadPart) {
        const payload = JSON.parse(
          Buffer.from(payloadPart, "base64").toString()
        );
        if (payload && payload.url) return payload.url;
      }
    } catch (_) {}
  }
  return raw.startsWith("http") ? raw : null;
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

    let htmlContent = "";

    try {
      const res = await axios.post(
        "https://snapsave.app/action.php",
        `url=${encodeURIComponent(cleanUrl)}`,
        { headers, timeout: 15000 }
      );
      if (typeof res.data === "string") {
        htmlContent = decodeSnapSave(res.data);
      }
    } catch (_) {
      const res = await axios.post(
        "https://savevid.net/action.php",
        `url=${encodeURIComponent(cleanUrl)}`,
        {
          headers: {
            ...headers,
            Origin: "https://savevid.net",
            Referer: "https://savevid.net/",
          },
          timeout: 15000,
        }
      );
      if (typeof res.data === "string") {
        htmlContent = decodeSnapSave(res.data);
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
        $(item).find(".download-items__thumb img, .thumbnail img, img").first().attr("src") ||
        "";

      $(item).find("a.abutton, .download-items__btn a, a[href*='rapidcdn'], a[href*='snapcdn'], a.btn-download").each((_, a) => {
        const rawHref = $(a).attr("href");
        const finalUrl = extractFinalUrl(rawHref);
        if (!finalUrl || seen.has(finalUrl)) return;
        seen.add(finalUrl);

        const btnText = $(a).text().trim().toLowerCase();
        const isPhoto = btnText.includes("photo") || btnText.includes("image") || finalUrl.includes("/image");
        downloads.push({
          quality: isPhoto ? "photo" : "720p",
          type: isPhoto ? "photo" : "video",
          url: finalUrl,
          thumbnail: thumb || undefined,
        });
      });

      $(item).find("select option").each((_, opt) => {
        const val = $(opt).attr("value");
        if (!val || !val.startsWith("http") || val.includes("snapsave.app") || seen.has(val)) return;
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
      $("a[href^='http']").each((_, a) => {
        const href = $(a).attr("href");
        if (href && !href.includes("snapsave") && !href.includes("savevid") && !seen.has(href)) {
          seen.add(href);
          downloads.push({
            quality: "HD",
            type: "video",
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
    const thumbnail = downloads[0].thumbnail || $("img").first().attr("src") || "";

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
