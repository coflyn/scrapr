const axios = require("axios");
const cheerio = require("cheerio");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Krakenfiles URL.");
    }

    const match = url.match(
      /krakenfiles\.com\/(?:view|download)\/([a-zA-Z0-9]+)/i,
    );
    if (!match) {
      throw new Error("Could not extract Krakenfiles file ID from URL.");
    }
    const fileId = match[1];
    const pageUrl = `https://krakenfiles.com/view/${fileId}/file.html`;

    const getRes = await axios.get(pageUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      timeout: 15000,
    });

    const html = getRes.data || "";
    if (html.includes("File not found") || html.includes("file-not-found")) {
      throw new Error("Krakenfiles file not found or has been deleted.");
    }

    const cookies = (getRes.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const $ = cheerio.load(html);

    let filename =
      $(".coin-info h5").text().trim() ||
      $(".coin-info").first().text().trim() ||
      $(".file-name").text().trim() ||
      $("h5.nk-block-title").text().trim() ||
      $("title").text().replace("- Krakenfiles.com", "").trim() ||
      "Krakenfiles File";
    if (filename.includes("\n")) filename = filename.split("\n")[0].trim();

    let size =
      $(".lead-text").filter((_, el) => /[\d.]+\s*(?:MB|GB|KB|bytes)/i.test($(el).text())).first().text().trim() ||
      $(".coin-info span").text().trim() ||
      $(".file-size").text().trim() ||
      "";

    if (!size) {
      const sizeMatch = html.match(
        /\b([\d.]+\s*(?:MB|GB|KB|bytes|B))\b/i,
      );
      if (sizeMatch) size = sizeMatch[1];
    }

    const dlForm = $("#dl-form");
    const action = dlForm.attr("action") || `/download/${fileId}`;
    const token = dlForm.find('input[name="token"]').val() || "";

    const postUrl = action.startsWith("http")
      ? action
      : `https://krakenfiles.com${action}`;

    const formFields = {};
    dlForm.find("input").each((_, inp) => {
      const name = $(inp).attr("name");
      const val = $(inp).val();
      if (name) formFields[name] = val || "";
    });
    if (!formFields.token && token) formFields.token = token;

    let directUrl = "";
    try {
      const postRes = await axios.post(
        postUrl,
        new URLSearchParams(formFields).toString(),
        {
          headers: {
            "User-Agent": DEFAULT_UA,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: pageUrl,
            Origin: "https://krakenfiles.com",
            Cookie: cookies,
          },
          timeout: 15000,
        },
      );

      if (postRes.data?.status === "ok" && postRes.data?.url) {
        directUrl = postRes.data.url;
      }
    } catch (_) {}

    const downloadUrl = directUrl || postUrl;

    return {
      status: true,
      result: {
        title: filename,
        filename,
        size: size || "Unknown",
        url: downloadUrl,
        downloads: [
          {
            type: "file",
            quality: directUrl ? "Direct Download" : "Download Page",
            url: downloadUrl,
          },
        ],
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve Krakenfiles URL.",
    };
  }
}

module.exports = { scrape };
