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
  let isRender = false;

  if (raw.includes("get_progressApi")) {
    isRender = true;
    const tokenMatch = raw.match(/token=([^&'"]+)/);
    if (tokenMatch) {
      raw = tokenMatch[1];
    }
  }

  if (raw.includes(".") && !raw.startsWith("http")) {
    try {
      const payloadPart = raw.split(".")[1];
      if (payloadPart) {
        const payload = JSON.parse(
          Buffer.from(payloadPart, "base64").toString(),
        );
        if (payload.video_url)
          return { url: payload.video_url, isRender: true };
        if (payload.url) return { url: payload.url, isRender: false };
      }
    } catch (e) {}
  }

  if (raw.startsWith("//")) return { url: "https:" + raw, isRender };
  if (raw.startsWith("/"))
    return { url: "https://snapsave.app" + raw, isRender };

  return { url: raw, isRender };
}

async function scrape(url) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      Origin: "https://snapsave.app",
      Referer: "https://snapsave.app/id",
    };

    let finalUrl = url.trim();
    try {
      const redirectCheck = await axios.get(finalUrl, {
        headers,
        maxRedirects: 5,
      });
      finalUrl = redirectCheck.request.res.responseUrl || finalUrl;
    } catch (e) {}

    const r1 = await axios.get("https://snapsave.app/id", { headers });
    const cookies = r1.headers["set-cookie"];
    const cookieStr = cookies
      ? cookies.map((c) => c.split(";")[0]).join("; ")
      : "";

    const params = new URLSearchParams();
    params.append("url", finalUrl);

    const response = await axios.post(
      "https://snapsave.app/action.php?lang=id",
      params.toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieStr,
        },
      },
    );

    const decodedHtml = decodeSnapSave(response.data);
    const $ = cheerio.load(decodedHtml);

    const downloads = [];

    $("table tbody tr").each((i, el) => {
      const quality = $(el).find("td.video-quality").length
        ? $(el).find("td.video-quality").text().trim()
        : $(el).find("td").eq(0).text().trim();
      const renderStatus = $(el).find("td").eq(1).text().trim().toLowerCase();
      const linkAttr =
        $(el).find("a.btn-download").attr("href") ||
        $(el).find("button").attr("onclick") ||
        $(el).find("a").attr("href");

      const extracted = extractFinalUrl(linkAttr);

      if (extracted && extracted.url.startsWith("http")) {
        const hasAudio =
          renderStatus === "no" ||
          renderStatus === "tidak" ||
          !extracted.isRender;

        downloads.push({
          quality: quality || "Normal",
          url: extracted.url,
          hasAudio: hasAudio,
          type: "video",
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("Could not extract download links.");
    }

    const sorted = downloads.sort((a, b) => {
      if (a.hasAudio && !b.hasAudio) return -1;
      if (!a.hasAudio && b.hasAudio) return 1;

      const aVal = a.quality.toLowerCase();
      const bVal = b.quality.toLowerCase();
      if (aVal.includes("hd") || aVal.includes("720")) return -1;
      if (bVal.includes("hd") || bVal.includes("720")) return 1;
      return 0;
    });

    return {
      status: true,
      result: {
        title: "Facebook Video",
        thumbnail: "",
        type: "video",
        downloads: sorted,
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
