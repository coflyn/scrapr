const axios = require("axios");
const cheerio = require("cheerio");

async function resolveSpotifyUrl(url) {
  let target = url.trim();
  if (target.includes("spotify.link") || target.includes("spotify.com/s/")) {
    try {
      const res = await axios.get(target, {
        headers: {
          "User-Agent": "WhatsApp/2.21.19.21 A",
        },
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 10000,
      });
      if (res.headers.location) {
        target = res.headers.location.split("?")[0];
      } else if (res.data && typeof res.data === "string") {
        const ogMatch = res.data.match(/<meta property="og:url" content="([^"]+)"/i);
        if (ogMatch && ogMatch[1]) {
          target = ogMatch[1].split("?")[0];
        }
      }
    } catch (_) {}
  }
  return target.split("?")[0];
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("URL is required");
    }

    const cleanUrl = await resolveSpotifyUrl(url);
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://spotidown.app/",
      Origin: "https://spotidown.app",
    };

    const r2 = await axios.post(
      "https://spotidown.app/action",
      new URLSearchParams({
        url: cleanUrl,
        "g-recaptcha-response": "dummy_token",
      }).toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        timeout: 15000,
      }
    );

    const cookies = (r2.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const r2Data = typeof r2.data === "string" ? JSON.parse(r2.data) : r2.data;
    if (!r2Data || r2Data.error) {
      throw new Error(r2Data?.message || "Failed to process Spotify URL on SpotiDown.");
    }

    const $ = cheerio.load(r2Data.data || r2Data);
    const forms = $('form[name="submitspurl"]');

    if (!forms.length) {
      throw new Error("No tracks found for this Spotify link.");
    }

    const isMultiTrack = forms.length > 1;
    const tracks = [];

    forms.each((i, form) => {
      const dataVal = $(form).find('input[name="data"]').val() || "";
      const baseVal = $(form).find('input[name="base"]').val() || cleanUrl;
      const tokenVal = $(form).find('input[name="token"]').val() || "";
      let meta = {};
      if (dataVal) {
        try {
          meta = JSON.parse(Buffer.from(dataVal, "base64").toString("utf-8"));
        } catch (_) {}
      }

      const container = $(form).closest(".grid-container, .row, .spotidown-downloader, div");
      const name = meta.name || meta.title || container.find("h1, h2, h3").first().text().trim() || "Spotify Track";
      const artist = meta.artist || meta.singer || container.find("p").first().text().trim() || "";
      const thumbnail =
        meta.cover ||
        $(form).closest(".grid-container").find("img").attr("src") ||
        $(".spotidown-downloader-left img").attr("src") ||
        "";

      tracks.push({
        index: i + 1,
        title: name,
        artist,
        album: meta.album || undefined,
        duration: meta.duration || undefined,
        thumbnail,
        payload: {
          data: dataVal,
          base: baseVal,
          token: tokenVal,
          "g-recaptcha-response": "dummy_token",
        },
      });
    });

    const first = tracks[0];
    const r3 = await axios.post(
      "https://spotidown.app/action/track",
      new URLSearchParams(first.payload).toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: cookies,
        },
        timeout: 15000,
      }
    );

    const r3Data = typeof r3.data === "string" ? JSON.parse(r3.data) : r3.data;
    if (!r3Data || r3Data.error) {
      throw new Error(r3Data?.message || "Failed to resolve track download link.");
    }

    const $3 = cheerio.load(r3Data.data || r3Data);
    const downloads = [];
    $3("a").each((_, a) => {
      const href = $3(a).attr("href");
      const text = $3(a).text().trim();
      if (
        href &&
        href.startsWith("http") &&
        !href.includes("premium.html") &&
        text !== "Download Another Song"
      ) {
        const isCover = text.toLowerCase().includes("cover") || href.includes("cover");
        downloads.push({
          type: isCover ? "image" : "audio",
          quality: isCover ? "Cover [HD]" : "320kbps",
          url: href,
        });
      }
    });

    if (downloads.length === 0) {
      throw new Error("No download links found from SpotiDown.");
    }

    const result = {
      title: isMultiTrack
        ? `${first.artist ? first.artist + " - " : ""}${first.album || first.title} (${tracks.length} tracks)`
        : first.artist
          ? `${first.artist} - ${first.title}`
          : first.title,
      artist: first.artist || undefined,
      album: first.album || undefined,
      thumbnail: first.thumbnail,
      type: isMultiTrack ? "playlist" : "audio",
      trackCount: isMultiTrack ? tracks.length : 1,
      downloads,
    };

    if (isMultiTrack) {
      result.tracks = tracks.map((t) => ({
        index: t.index,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        thumbnail: t.thumbnail,
      }));
    }

    return {
      status: true,
      result,
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to scrape Spotify via SpotiDown.",
    };
  }
}

module.exports = { scrape };
