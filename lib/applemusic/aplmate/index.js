const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://aplmate.com/",
      Origin: "https://aplmate.com",
    };

    const r1 = await axios.get("https://aplmate.com/", { headers: { ...headers, Accept: "text/html" } });
    const cookieStr = (r1.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

    const r2 = await axios.post("https://aplmate.com/action/userverify", `url=${encodeURIComponent(url)}`, {
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Cookie: cookieStr },
    });
    const token = r2.data?.success ? r2.data.token : null;
    if (!token) throw new Error(r2.data?.message || "Failed to get verification token.");

    const fd1 = new URLSearchParams();
    fd1.append("url", url);
    fd1.append("cf-turnstile-response", token);
    const r3 = await axios.post("https://aplmate.com/action", fd1.toString(), {
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieStr },
    });
    if (r3.data.error) throw new Error(r3.data.message || "Error during initial action.");

    let firstMeta = null;
    let finalHtml = r3.data.html;
    const $ = cheerio.load(r3.data.html);
    const form2 = $('form[name="submitapurl"]');
    if (form2.length) {
      const fb = form2.find('input[name="data"]').val();
      if (fb) {
        try {
          firstMeta = JSON.parse(Buffer.from(fb, "base64").toString("utf-8"));
        } catch (_) {}
      }
      try {
        const fd2 = new URLSearchParams();
        form2.find("input").each((i, el) => {
          const name = $(el).attr("name");
          const value = $(el).attr("value") || "";
          if (name) fd2.append(name, value);
        });
        const r4 = await axios.post("https://aplmate.com/action/track", fd2.toString(), {
          headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieStr },
          timeout: 8000,
        });
        if (!r4.data.error && r4.data.data) {
          finalHtml = r4.data.data;
        }
      } catch (_) {}
    }

    const $2 = cheerio.load(finalHtml);
    const title = firstMeta?.name || $2(".hover-underline").first().text().trim() || $2("h3").first().text().trim() || "Apple Music Content";
    const artist = firstMeta?.artist || $2("p").first().text().trim() || "";
    const thumbnail = firstMeta?.cover || $2("img").first().attr("src") || null;
    const downloads = [];
    $2("a").each((i, el) => {
      const link = $2(el).attr("href");
      const text = $2(el).text().trim();
      if (link && (link.includes("/dl?token=") || $2(el).hasClass("abutton"))) {
        if (link.includes("ko-fi.com") || link.includes("premium.html")) return;
        downloads.push({ type: text || "Download", url: link.startsWith("http") ? link : "https://aplmate.com" + link });
      }
    });

    if (downloads.length === 0 && (firstMeta?.cover || thumbnail)) {
      downloads.push({
        type: "cover",
        quality: "HD Cover",
        url: firstMeta?.cover || thumbnail,
      });
    }

    return { status: true, result: { title: artist ? `${artist} - ${title}` : title, thumbnail, type: "audio", downloads } };
  } catch (error) {
    return { status: false, message: error.message };
  }
}

module.exports = { scrape };
