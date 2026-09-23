const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const cleanUrl = url.trim().split("?")[0];
    const BASE = "https://soundloaders.app";
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

    const r1 = await axios.get(BASE + "/", {
      headers: { "User-Agent": ua },
      timeout: 10000,
    });
    const cookies = (r1.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

    let token = "";
    try {
      const vRes = await axios.post(
        BASE + "/api/userverify",
        new URLSearchParams({ url: cleanUrl }).toString(),
        {
          headers: {
            "User-Agent": ua,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Referer: BASE + "/",
            Origin: BASE,
            Cookie: cookies,
          },
          timeout: 8000,
        }
      );
      if (vRes.data?.token) token = vRes.data.token;
    } catch (_) {}

    const { data: actRes } = await axios.post(
      BASE + "/action",
      new URLSearchParams({ url: cleanUrl, cftoken: token }).toString(),
      {
        headers: {
          "User-Agent": ua,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: BASE + "/",
          Origin: BASE,
          Cookie: cookies,
        },
        timeout: 12000,
      }
    );

    if (!actRes || actRes.status === false) {
      throw new Error(actRes?.error || "SoundLoaders returned an error.");
    }

    const html = actRes.html || "";
    const $ = cheerio.load(html);

    const titleH2 = $("h2").first().text().trim();
    const artistP = $('p.text-sm, p[class*="text-white"]').first().text().trim();
    const thumbImg = $('img[class*="rounded"], img').first().attr("src") || "";

    const tracks = [];
    $('form[name="submitspurl"]').each((_, form) => {
      const dataVal = $(form).find('input[name="data"]').val() || "";
      const trackToken = $(form).find('input[name="track_token"]').val() || "";
      let trackInfo = { title: "", artist: "", thumbnail: "" };

      if (dataVal) {
        try {
          const decoded = JSON.parse(Buffer.from(dataVal, "base64").toString());
          trackInfo.title = decoded.name || "";
          trackInfo.artist = decoded.artist || "";
          trackInfo.thumbnail = decoded.cover || "";
        } catch (_) {}
      }

      tracks.push({
        data: dataVal,
        trackToken,
        title: trackInfo.title || titleH2 || "Spotify Track",
        artist: trackInfo.artist || artistP || "",
        thumbnail: trackInfo.thumbnail || thumbImg,
      });
    });

    if (tracks.length === 0) {
      throw new Error("No tracks found from SoundLoaders.");
    }

    const downloads = [];
    const firstTrack = tracks[0];

    if (tracks.length === 1 && firstTrack.data && firstTrack.trackToken) {
      try {
        const { data: dlRes } = await axios.post(
          BASE + "/action/tracks",
          new URLSearchParams({
            data: firstTrack.data,
            track_token: firstTrack.trackToken,
          }).toString(),
          {
            headers: {
              "User-Agent": ua,
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              Referer: BASE + "/",
              Origin: BASE,
              Cookie: cookies,
            },
            timeout: 4000,
          }
        );

        if (dlRes && dlRes.html) {
          const $dl = cheerio.load(dlRes.html);
          $dl("a[href^='http']").each((_, a) => {
            const href = $dl(a).attr("href");
            const text = $dl(a).text().trim();
            if (href && !href.includes("tunecable") && !href.includes("premium")) {
              const isCover = text.toLowerCase().includes("cover") || href.includes("cover");
              downloads.push({
                quality: isCover ? "cover" : "320kbps",
                type: isCover ? "photo" : "audio",
                url: href,
              });
            }
          });
        }
      } catch (_) {}
    }

    if (downloads.length === 0) {
      tracks.forEach((t, i) => {
        const label = t.artist ? `${t.artist} - ${t.title}` : t.title;
        downloads.push({
          quality: "320kbps",
          type: "audio",
          title: label,
          trackIndex: i + 1,
          url: BASE + "/action",
        });
      });
    }

    return {
      status: true,
      result: {
        title: firstTrack.title || titleH2 || "Spotify Track",
        artist: firstTrack.artist || artistP || undefined,
        thumbnail: firstTrack.thumbnail || thumbImg,
        type: "audio",
        downloads,
      },
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape Spotify via SoundLoaders.",
    };
  }
}

module.exports = { scrape };
