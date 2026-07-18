const axios = require("axios");

async function scrape(url) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    Referer: "https://www.klickaud.org/en14",
    Origin: "https://www.klickaud.org",
  };

  const r1 = await axios.get("https://www.klickaud.org/en14", { headers });
  const cookieStr = (r1.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

  const params = new URLSearchParams();
  params.append("value", url);
  params.append("csrf_token", "");

  await axios.post("https://www.klickaud.org/download.php", params.toString(), {
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieStr },
  });

  const sseUrl = `https://www.klickaud.org/worker_sse.php?url=${encodeURIComponent(url)}`;
  const cleanUrl = new URL(sseUrl);
  cleanUrl.searchParams.delete("url");
  const sseParams = cleanUrl.search;

  return new Promise((resolve, reject) => {
    axios({
      method: "get",
      url: sseUrl,
      responseType: "stream",
      headers: { ...headers, Referer: "https://www.klickaud.org/download.php", Cookie: cookieStr, Accept: "text/event-stream" },
      timeout: 60000,
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
                    const title = data.file_name ? data.file_name.replace(/_KLICKAUD\.mp3$/i, "").replace(/_/g, " ") : "SoundCloud Track";
                    resolve({ status: true, result: { title, type: "audio", downloads: [{ type: "MP3 (128kbps)", url: data.download_url }] } });
                    response.data.destroy();
                  }
                } catch (e) {}
              }
            }
          }

          if (buffer.includes("event: failed")) {
            found = true;
            reject(new Error("Worker failed to process this track."));
            response.data.destroy();
          }
        });

        response.data.on("end", () => { if (!found) reject(new Error("SSE stream ended without a download link.")); });
        response.data.on("error", (err) => { if (!found) reject(err); });
      })
      .catch(reject);
  });
}

module.exports = { scrape };
