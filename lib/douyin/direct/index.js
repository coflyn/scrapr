const axios = require("axios");
const cheerio = require("cheerio");

function extractRouterData(html) {
  const marker = "window._ROUTER_DATA =";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;
  const slice = html.substring(startIdx + marker.length).trim();
  let braceCount = 0, inString = false, stringChar = null, escape = false, endIdx = -1;
  for (let i = 0; i < slice.length; i++) {
    const char = slice[i];
    if (escape) { escape = false; continue; }
    if (char === "\\") { escape = true; continue; }
    if (inString) { if (char === stringChar) inString = false; continue; }
    if (char === '"' || char === "'") { inString = true; stringChar = char; continue; }
    if (char === "{") braceCount++;
    else if (char === "}") { braceCount--; if (braceCount === 0) { endIdx = i + 1; break; } }
  }
  return endIdx !== -1 ? slice.substring(0, endIdx) : null;
}

async function scrape(url) {
  const cleanUrl = url.trim();
  const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";

  const pageRes = await axios.get(cleanUrl, {
    headers: {
      "User-Agent": mobileUA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    timeout: 20000,
  });

  const html = pageRes.data;
  const routerDataStr = extractRouterData(html);
  if (!routerDataStr) throw new Error("Could not find video data in page.");

  const routerData = JSON.parse(routerDataStr);
  const loaderData = routerData.loaderData || {};
  let videoInfoRes = null;
  for (const key in loaderData) {
    if (loaderData[key]?.videoInfoRes) { videoInfoRes = loaderData[key].videoInfoRes; break; }
  }
  if (!videoInfoRes?.item_list?.length) throw new Error("Could not locate video data.");

  const item = videoInfoRes.item_list[0];
  const title = item.desc || "Douyin Video";
  const author = item.author?.nickname || "Unknown";
  const thumbnail = item.video?.cover?.url_list?.[0] || null;
  const watermarkUrl = item.video?.play_addr?.url_list?.[0];
  if (!watermarkUrl) throw new Error("No video URL found.");

  let videoId = null;
  try { videoId = new URL(watermarkUrl).searchParams.get("video_id"); } catch (e) {}
  if (!videoId) { const m = watermarkUrl.match(/video_id=([^&]+)/); if (m) videoId = m[1]; }
  const noWatermarkUrl = videoId ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}` : watermarkUrl;

  return {
    status: true,
    result: { title, author, thumbnail, downloads: [{ type: "video", quality: "no_watermark", url: noWatermarkUrl }, { type: "video", quality: "watermark", url: watermarkUrl }] },
  };
}

module.exports = { scrape };
