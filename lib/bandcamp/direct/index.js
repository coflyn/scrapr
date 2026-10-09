const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url, options = {}) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("URL is required");
    }
    const cleanUrl = url.trim().split("?")[0];

    const res = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": "curl/8.7.1",
        Accept: "*/*",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const tralbumEl = $("script[data-tralbum]");
    const tralbumRaw = tralbumEl.attr("data-tralbum");
    if (!tralbumRaw) {
      throw new Error("Could not find track metadata in Bandcamp page.");
    }

    const data = JSON.parse(tralbumRaw);
    const artist =
      data.artist ||
      $("meta[property='og:site_name']").attr("content") ||
      "Bandcamp Artist";
    let cover =
      $("link[rel='image_src']").attr("href") ||
      $("meta[property='og:image']").attr("content") ||
      "";
    if (cover && cover.includes("_16.")) {
      cover = cover.replace("_16.", "_10.");
    }

    const title =
      data.current?.title ||
      $("meta[property='og:title']").attr("content") ||
      "Bandcamp Track";
    const releaseYear = data.current?.publish_date
      ? new Date(data.current.publish_date).getFullYear().toString()
      : null;
    const album = data.current?.type === "album" ? title : null;
    const isAlbum =
      data.current?.type === "album" ||
      (Array.isArray(data.trackinfo) && data.trackinfo.length > 1);

    const tracks = (data.trackinfo || []).map((t, idx) => {
      const streamUrl = t.file
        ? t.file["mp3-128"] || Object.values(t.file)[0]
        : null;
      const dlLinks = [];
      if (streamUrl) {
        dlLinks.push({
          type: "Download MP3 (128kb)",
          quality: "128kbps",
          url: streamUrl,
        });
      }
      if (cover) {
        dlLinks.push({
          type: "Download Cover [HD]",
          quality: "Cover [HD]",
          url: cover,
        });
      }
      return {
        index: t.track_num || idx + 1,
        title: t.title,
        artist: t.artist || artist,
        album: album || null,
        cover: cover || null,
        releaseYear: releaseYear || null,
        downloads: dlLinks,
      };
    });

    const downloads = [];
    for (const track of tracks) {
      for (const dl of track.downloads) {
        if (!downloads.some((d) => d.url === dl.url)) {
          downloads.push(dl);
        }
      }
    }

    return {
      status: true,
      result: {
        title,
        artist,
        album,
        cover,
        releaseYear,
        type: isAlbum ? "album" : "track",
        trackCount: tracks.length,
        tracks,
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
