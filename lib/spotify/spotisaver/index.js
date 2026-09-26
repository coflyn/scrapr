const axios = require("axios");

const BASE = "https://spotisaver.net";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const REGEX_SPOTIFY =
  /spotify\.com\/(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]+)/;

async function scrape(url) {
  try {
    const match = url.match(REGEX_SPOTIFY);
    if (!match) throw new Error("Must be a valid Spotify URL.");

    const type = match[1];
    const id = match[2];
    const lang = "en";

    const r1 = await axios.get(BASE + "/en1", {
      headers: { "User-Agent": UA },
      timeout: 10000,
    });

    const cookies = (r1.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const html = r1.data;

    const matchSig = html.match(/playlistRequestSignature\s*=\s*(\{.*?\});/s);
    if (!matchSig) {
      throw new Error("Could not parse signature configuration from Spotisaver.");
    }

    // Safely parse JSON-like signature config
    let sigConfig;
    try {
      sigConfig = new Function(`return (${matchSig[1]});`)();
    } catch (_) {
      throw new Error("Failed to evaluate signature configuration.");
    }

    const matchIp = html.match(/user_ip\s*=\s*["\x27](.*?)["\x27]/);
    const userIp = matchIp ? matchIp[1] : "";

    const wire = sigConfig.wire || {};
    const ctxObj = { id, type, lang };
    const b64 = Buffer.from(JSON.stringify(ctxObj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const sigParams = new URLSearchParams();
    sigParams.set(wire.token_param, sigConfig.requestToken);
    sigParams.set(wire.action_param, wire.actions["get_playlist"]);
    sigParams.set(wire.ctx_param, b64);

    const rSig = await axios.get(
      BASE + sigConfig.endpoint + "?" + sigParams.toString(),
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: BASE + "/en1",
          Cookie: cookies,
        },
        timeout: 10000,
      },
    );

    if (!rSig.data || !rSig.data.success || !rSig.data.token) {
      throw new Error("Failed to obtain request signature from Spotisaver.");
    }

    const reqHeaders = {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: BASE + "/en1",
      Cookie: cookies,
    };
    reqHeaders[wire.sig_header] = rSig.data.token;
    reqHeaders[wire.exp_header] = String(rSig.data.exp);

    const rPlay = await axios.get(
      BASE + `/api/get_playlist.php?id=${id}&type=${type}&lang=${lang}`,
      {
        headers: reqHeaders,
        timeout: 15000,
      },
    );

    const data = rPlay.data;
    if (!data || data.error) {
      throw new Error(
        data?.error || "Failed to retrieve Spotify data from Spotisaver.",
      );
    }

    const info = data.playlist_info || {};
    const rawTracks = data.tracks || [];
    if (rawTracks.length === 0) {
      throw new Error("No tracks found from Spotisaver.");
    }

    const first = rawTracks[0];
    const isMultiTrack = type !== "track" || rawTracks.length > 1;
    const title = first.name || info.name || "Spotify Track";
    const artist =
      first.artists && first.artists.length > 0
        ? first.artists.join(", ")
        : info.owner || "";
    const thumbnail =
      first.image?.url || (info.images && info.images[0]?.url) || "";

    const downloads = [
      {
        type: "audio",
        quality: "320kbps",
        url: `${BASE}/api/download_track.php?id=${first.id}`,
      },
    ];

    if (thumbnail) {
      downloads.push({
        type: "image",
        quality: "Cover [HD]",
        url: thumbnail,
      });
    }

    const tracks = rawTracks.map((t, idx) => ({
      index: idx + 1,
      id: t.id,
      title: t.name,
      artist: t.artists ? t.artists.join(", ") : "",
      album: t.album || undefined,
      duration: t.duration_ms ? Math.round(t.duration_ms / 1000) : undefined,
      thumbnail: t.image?.url || t.thumb_image?.url || thumbnail,
    }));

    const result = {
      title: isMultiTrack
        ? `${artist ? artist + " - " : ""}${info.name || title} (${tracks.length} tracks)`
        : artist
          ? `${artist} - ${title}`
          : title,
      artist: artist || undefined,
      album: first.album || (type === "album" ? info.name : undefined),
      thumbnail,
      type: isMultiTrack ? "playlist" : "audio",
      trackCount: tracks.length,
      downloads,
    };

    if (isMultiTrack) {
      result.tracks = tracks;
    }

    // Helper to download the direct MP3 buffer
    result.getAudioBuffer = async (trackIndex = 0) => {
      const target = rawTracks[trackIndex] || first;
      const dlCtx = {
        lang: "en",
        id: String(target.id).trim(),
        name: String(target.name).trim(),
        duration_ms: String(Math.trunc(target.duration_ms || 0)),
      };
      const b64Dl = Buffer.from(JSON.stringify(dlCtx))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

      const dlSigParams = new URLSearchParams();
      dlSigParams.set(wire.token_param, sigConfig.requestToken);
      dlSigParams.set(wire.action_param, wire.actions["download_track"]);
      dlSigParams.set(wire.ctx_param, b64Dl);

      const rDlSig = await axios.get(
        BASE + sigConfig.endpoint + "?" + dlSigParams.toString(),
        {
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            Referer: BASE + "/en1",
            Cookie: cookies,
          },
          timeout: 10000,
        },
      );

      const dlHeaders = {
        "User-Agent": UA,
        "Content-Type": "application/json",
        Referer: BASE + "/en1",
        Cookie: cookies,
      };
      dlHeaders[wire.sig_header] = rDlSig.data.token;
      dlHeaders[wire.exp_header] = String(rDlSig.data.exp);

      const rDl = await axios.post(
        BASE + "/api/download_track.php",
        {
          track: target,
          download_dir: "downloads",
          filename_tag: "SPOTISAVER",
          user_ip: userIp,
          is_premium: false,
          lang: "en",
        },
        {
          headers: dlHeaders,
          responseType: "arraybuffer",
          timeout: 45000,
        },
      );

      return Buffer.from(rDl.data);
    };

    return {
      status: true,
      result,
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to scrape Spotify via Spotisaver.",
    };
  }
}

module.exports = { scrape };
