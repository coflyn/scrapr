const axios = require("axios");

async function scrape(url) {
  try {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    let cookies = [];

    const updateCookies = (res) => {
      const setCookie = res.headers["set-cookie"] || [];
      setCookie.forEach((c) => {
        const val = c.split(";")[0];
        if (val) cookies.push(val);
      });
    };

    const getCookieHeader = () => cookies.join("; ");

    // Step 1: Get CSRF token
    const tokenRes = await axios.get("https://www.klickaud.org/csrf-token-endpoint.php", {
      headers: {
        "User-Agent": ua,
        Referer: "https://www.klickaud.org/en17/",
        Accept: "application/json",
      },
      timeout: 10000,
    });
    updateCookies(tokenRes);

    const csrfToken = tokenRes.data?.csrf_token;
    if (!csrfToken) {
      return { status: false, message: "Failed to obtain CSRF token from Klickaud." };
    }

    // Step 2: Submit track URL
    const params = new URLSearchParams();
    params.append("value", url);
    params.append("csrf_token", csrfToken);

    const postRes = await axios.post("https://www.klickaud.org/download.php", params.toString(), {
      headers: {
        "User-Agent": ua,
        Referer: "https://www.klickaud.org/en17/",
        Origin: "https://www.klickaud.org",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: getCookieHeader(),
      },
      timeout: 15000,
    });
    updateCookies(postRes);

    const html = postRes.data || "";
    const downloadMode = (html.match(/const\s+downloadMode\s*=\s*["']([^"']+)["']/) || [])[1];
    const directUrl = (html.match(/const\s+directDownloadUrl\s*=\s*["']([^"']*)["']/) || [])[1];
    const defaultFileName = (html.match(/const\s+defaultFileName\s*=\s*["']([^"']+)["']/) || [])[1] || "SoundCloud Track";
    const sseGrant = (html.match(/const\s+sseGrant\s*=\s*["']([^"']+)["']/) || [])[1];

    const cleanTitle = (raw) =>
      raw
        .replace(/_KLICKAUD\.mp3$/i, "")
        .replace(/_forhub_soundcloud_to_mp3\.mp3$/i, "")
        .replace(/\.mp3$/i, "")
        .replace(/_/g, " ")
        .trim();

    // Mode A: Direct download exists immediately
    if (downloadMode === "direct" && directUrl) {
      return {
        status: true,
        result: {
          title: cleanTitle(defaultFileName),
          type: "audio",
          downloads: [{ type: "MP3 (128kbps)", url: directUrl }],
        },
      };
    }

    // Mode B: Worker SSE processing
    if (!sseGrant) {
      return { status: false, message: "Could not retrieve download session grant from Klickaud." };
    }

    const capRes = await axios.post(
      "https://www.klickaud.org/sse_capability.php",
      { grant: sseGrant, url },
      {
        headers: {
          "User-Agent": ua,
          Referer: "https://www.klickaud.org/download.php",
          Origin: "https://www.klickaud.org",
          "Content-Type": "application/json",
          Cookie: getCookieHeader(),
        },
        timeout: 10000,
      }
    );
    updateCookies(capRes);

    const capability = capRes.data?.capability;
    if (!capability) {
      return { status: false, message: "Could not authorize download capability." };
    }

    const sseUrl = `https://www.klickaud.org/worker_sse.php?url=${encodeURIComponent(url)}&cap=${encodeURIComponent(capability)}`;

    return await new Promise((resolve) => {
      axios({
        method: "get",
        url: sseUrl,
        responseType: "stream",
        headers: {
          "User-Agent": ua,
          Referer: "https://www.klickaud.org/download.php",
          Cookie: getCookieHeader(),
          Accept: "text/event-stream",
        },
        timeout: 45000,
      })
        .then((response) => {
          let buffer = "";
          let found = false;

          response.data.on("data", (chunk) => {
            if (found) return;
            buffer += chunk.toString();

            if (buffer.includes("event: ready")) {
              const lines = buffer.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === "event: ready" && lines[i + 1]?.startsWith("data:")) {
                  try {
                    const data = JSON.parse(lines[i + 1].replace("data:", "").trim());
                    if (data.download_url) {
                      found = true;
                      const title = data.file_name ? cleanTitle(data.file_name) : cleanTitle(defaultFileName);
                      resolve({
                        status: true,
                        result: {
                          title,
                          type: "audio",
                          downloads: [{ type: "MP3 (128kbps)", url: data.download_url }],
                        },
                      });
                      response.data.destroy();
                    }
                  } catch (e) {}
                }
              }
            }

            if (buffer.includes("event: failed")) {
              found = true;
              resolve({ status: false, message: "Worker failed to process this track." });
              response.data.destroy();
            }
          });

          response.data.on("end", () => {
            if (!found) resolve({ status: false, message: "SSE stream ended without download URL." });
          });

          response.data.on("error", (err) => {
            if (!found) resolve({ status: false, message: err.message });
          });
        })
        .catch((err) => resolve({ status: false, message: err.message }));
    });
  } catch (err) {
    return { status: false, message: err.message };
  }
}

module.exports = { scrape };
