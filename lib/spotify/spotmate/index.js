const axios = require("axios");
const cheerio = require("cheerio");

const baseUrl = "https://spotmate.online";
const regexSpotifyUrl = /open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

async function scrape(url) {
  try {
    if (!regexSpotifyUrl.test(url)) {
      throw new Error("Must be a valid Spotify URL.");
    }

    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const client = axios.create({
      baseURL: baseUrl,
      headers: {
        "User-Agent": userAgent,
      },
    });

    const r1 = await client.get("/en1");
    const cookies = r1.headers["set-cookie"];
    const cookieHeader = cookies ? cookies.map((c) => c.split(";")[0]).join("; ") : "";

    const $ = cheerio.load(r1.data);
    const csrfToken = $('meta[name="csrf-token"]').attr("content");

    if (!csrfToken) {
      throw new Error("Could not extract CSRF token from Spotmate.");
    }

    const apiHeaders = {
      "X-CSRF-TOKEN": csrfToken,
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Referer: "https://spotmate.online/en1",
      Origin: "https://spotmate.online",
      "X-Requested-With": "XMLHttpRequest",
    };

    const r2 = await client.post(
      "/getTrackData",
      { spotify_url: url },
      { headers: apiHeaders }
    );

    const trackData = r2.data;
    if (!trackData || trackData.error || !trackData.name) {
      throw new Error(trackData.message || "Failed to fetch track details from Spotmate.");
    }

    const title = trackData.name;
    const artist = trackData.artists ? trackData.artists.map((a) => a.name).join(", ") : "Unknown Artist";
    const thumbnail = trackData.album && trackData.album.images && trackData.album.images[0]
      ? trackData.album.images[0].url
      : "";

    const r3 = await client.post(
      "/convert",
      { urls: url },
      { headers: apiHeaders }
    );

    const convertData = r3.data;
    if (!convertData || convertData.error || !convertData.url) {
      throw new Error(convertData.message || "Failed to get download URL from Spotmate.");
    }

    return {
      status: true,
      result: {
        title: artist ? `${artist} - ${title}` : title,
        thumbnail,
        type: "audio",
        downloads: [
          {
            type: "mp3",
            url: convertData.url,
          },
        ],
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
