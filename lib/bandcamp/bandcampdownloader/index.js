const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url, options = {}) {
  const quality = options.quality || "320";

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      Referer: "https://bandcampdownloader.app/",
      Origin: "https://bandcampdownloader.app",
    };

    const r1 = await axios.get("https://bandcampdownloader.app/", {
      headers,
      timeout: 15000,
    });
    const cookies = r1.headers["set-cookie"];
    const cookieStr = cookies
      ? cookies.map((c) => c.split(";")[0]).join("; ")
      : "";

    const $ = cheerio.load(r1.data);
    const csrfName = $('form[name="submitbcurl"] input[type="hidden"]').attr(
      "name"
    );
    const csrfValue = $('form[name="submitbcurl"] input[type="hidden"]').attr(
      "value"
    );

    if (!csrfName || !csrfValue) {
      throw new Error("Failed to extract CSRF token from page.");
    }

    const formData = new URLSearchParams();
    formData.append("url", url);
    formData.append(csrfName, csrfValue);

    const r2 = await axios.post(
      "https://bandcampdownloader.app/action",
      formData.toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieStr,
        },
        timeout: 30000,
      }
    );

    if (r2.data.error) {
      throw new Error(r2.data.message || "Failed to process Bandcamp URL.");
    }

    if (!r2.data.success || !r2.data.html) {
      throw new Error("Unexpected response from server.");
    }

    const $2 = cheerio.load(r2.data.html);
    const trackForms = $2('form[name="submitapurl"]');

    if (trackForms.length === 0) {
      throw new Error("No tracks found in the response.");
    }

    const firstDataB64 = $2(trackForms.first())
      .find('input[name="data"]')
      .val();
    const firstMeta = JSON.parse(
      Buffer.from(firstDataB64, "base64").toString("utf8")
    );

    const isAlbum = trackForms.length > 1;
    const tracks = [];

    trackForms.each((i, form) => {
      const dataVal = $2(form).find('input[name="data"]').val();
      const baseVal = $2(form).find('input[name="base"]').val();
      const tokenVal = $2(form).find('input[name="token"]').val();

      const meta = JSON.parse(Buffer.from(dataVal, "base64").toString("utf8"));

      tracks.push({
        index: i + 1,
        title: meta.name,
        artist: meta.artist,
        album: meta.album || null,
        cover: meta.cover || null,
        releaseYear: meta.release_year || null,
        _data: dataVal,
        _base: baseVal,
        _token: tokenVal,
      });
    });

    const downloads = [];

    for (const track of tracks) {
      try {
        const trackFormData = new URLSearchParams();
        trackFormData.append("data", track._data);
        trackFormData.append("base", track._base);
        trackFormData.append("token", track._token);
        trackFormData.append("type", quality);

        const r3 = await axios.post(
          "https://bandcampdownloader.app/action/track",
          trackFormData.toString(),
          {
            headers: {
              ...headers,
              "Content-Type": "application/x-www-form-urlencoded",
              Cookie: cookieStr,
            },
            timeout: 60000,
          }
        );

        if (r3.data.error) {
          downloads.push({
            index: track.index,
            title: track.title,
            artist: track.artist,
            album: track.album,
            cover: track.cover,
            releaseYear: track.releaseYear,
            error: r3.data.message || "Download failed",
          });
          continue;
        }

        const $3 = cheerio.load(r3.data.data);
        const dlLinks = [];

        $3("a.abutton").each((_, el) => {
          const href = $3(el).attr("href");
          const label = $3(el).text().trim();
          if (href && href.includes("/dl?token=")) {
            dlLinks.push({
              type: label,
              url: `https://bandcampdownloader.app${href}`,
            });
          }
        });

        downloads.push({
          index: track.index,
          title: track.title,
          artist: track.artist,
          album: track.album,
          cover: track.cover,
          releaseYear: track.releaseYear,
          downloads: dlLinks,
        });
      } catch (trackErr) {
        downloads.push({
          index: track.index,
          title: track.title,
          artist: track.artist,
          error: trackErr.message,
        });
      }
    }

    return {
      status: true,
      result: {
        title: isAlbum ? firstMeta.album || firstMeta.name : firstMeta.name,
        artist: firstMeta.artist,
        album: firstMeta.album || null,
        cover: firstMeta.cover || null,
        releaseYear: firstMeta.release_year || null,
        type: isAlbum ? "album" : "track",
        trackCount: downloads.length,
        tracks: downloads,
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
