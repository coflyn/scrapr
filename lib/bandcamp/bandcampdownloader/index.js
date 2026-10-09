const axios = require("axios");
const cheerio = require("cheerio");

function createMultipartBody(fields) {
  const boundary =
    "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  let body = "";
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
    }
  }
  body += `--${boundary}--\r\n`;
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function scrape(url, options = {}) {
  const quality = options.quality || "320";

  try {
    const cleanUrl = url.trim().split("?")[0];
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };

    const r1 = await axios.get("https://bandcampdownloader.app/", {
      headers,
      timeout: 15000,
    });
    let cookies = (r1.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const tokenRes = await axios.post(
      "https://bandcampdownloader.app/get/token",
      null,
      {
        headers: {
          ...headers,
          "X-BandcampDownloader": "form",
          Referer: "https://bandcampdownloader.app/",
          Origin: "https://bandcampdownloader.app",
          Cookie: cookies,
        },
        timeout: 15000,
      },
    );
    const tokenCookies = (tokenRes.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    if (tokenCookies) {
      cookies = cookies ? `${cookies}; ${tokenCookies}` : tokenCookies;
    }

    const csrfToken = tokenRes.data?.token;
    if (!csrfToken) {
      throw new Error("Failed to extract CSRF token from page.");
    }

    const actMp = createMultipartBody({
      url: cleanUrl,
      lang: "en",
      csrf_token: csrfToken,
    });

    const r2 = await axios.post(
      "https://bandcampdownloader.app/action",
      actMp.body,
      {
        headers: {
          ...headers,
          "Content-Type": actMp.contentType,
          Referer: "https://bandcampdownloader.app/",
          Origin: "https://bandcampdownloader.app",
          Cookie: cookies,
        },
        timeout: 30000,
      },
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
      Buffer.from(firstDataB64, "base64").toString("utf8"),
    );

    const isAlbum = trackForms.length > 1;
    const tracks = [];

    trackForms.each((i, form) => {
      const formFields = {};
      $2(form)
        .find("input")
        .each((_, inp) => {
          const name = $2(inp).attr("name");
          const val = $2(inp).attr("value");
          if (name) formFields[name] = val || "";
        });

      const meta = JSON.parse(
        Buffer.from(formFields.data, "base64").toString("utf8"),
      );

      tracks.push({
        index: i + 1,
        title: meta.name,
        artist: meta.artist,
        album: meta.album || null,
        cover: meta.cover || null,
        releaseYear: meta.release_year || null,
        fields: formFields,
      });
    });

    const downloads = [];

    for (const track of tracks) {
      try {
        const trackMp = createMultipartBody({
          ...track.fields,
          type: quality,
          csrf_token: csrfToken,
        });

        const r3 = await axios.post(
          "https://bandcampdownloader.app/action/track",
          trackMp.body,
          {
            headers: {
              ...headers,
              "Content-Type": trackMp.contentType,
              Referer: "https://bandcampdownloader.app/",
              Origin: "https://bandcampdownloader.app",
              Cookie: cookies,
            },
            timeout: 60000,
          },
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

        const trackHtml =
          typeof r3.data === "object" ? r3.data.data : r3.data;
        const $3 = cheerio.load(trackHtml);
        const dlLinks = [];

        $3("a").each((_, el) => {
          const href = $3(el).attr("href");
          const label = $3(el).text().trim();
          if (
            href &&
            href.includes("/dl?token=") &&
            !label.toLowerCase().includes("another song")
          ) {
            dlLinks.push({
              type: label,
              url: href.startsWith("http")
                ? href
                : `https://bandcampdownloader.app${href}`,
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
        downloads: downloads.flatMap((t) => t.downloads || []),
      },
    };
  } catch (error) {
    try {
      const direct = require("../direct");
      const directRes = await direct.scrape(url, options);
      if (directRes && directRes.status) {
        return directRes;
      }
    } catch (_) {}

    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
