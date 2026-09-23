const axios = require("axios");

function extractDouyinItemId(text) {
  if (!text || typeof text !== "string") return null;
  const match =
    text.match(/(?:video|note|share\/(?:video|slides))\b[\/?](\d{15,22})/i) ||
    text.match(/modal_id=(\d{15,22})/i) ||
    text.match(/group_id=(\d{15,22})/i) ||
    text.match(/aweme_id=(\d{15,22})/i) ||
    text.match(/\/(\d{18,20})\b/);
  return match ? match[1] : null;
}

function parseJSObject(slice) {
  let braceCount = 0,
    inStr = false,
    strChar = null,
    escape = false,
    endIdx = -1;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (inStr) {
      if (c === strChar) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strChar = c;
      continue;
    }
    if (c === "{") braceCount++;
    else if (c === "}") {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx !== -1) {
    try {
      return JSON.parse(slice.substring(0, endIdx));
    } catch (e) {}
  }
  return null;
}

function extractRouterOrSSRData(htmlStr) {
  if (!htmlStr || typeof htmlStr !== "string") return null;

  const markers = [
    "window._ROUTER_DATA =",
    "window._SSR_DATA =",
    "window.__INIT_PROPS__ =",
    "window.__INITIAL_STATE__ =",
  ];

  for (const marker of markers) {
    const idx = htmlStr.indexOf(marker);
    if (idx !== -1) {
      const slice = htmlStr.substring(idx + marker.length).trim();
      const obj = parseJSObject(slice);
      if (obj) return obj;
    }
  }

  const scriptMatches = htmlStr.matchAll(
    /<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of scriptMatches) {
    try {
      const decoded = decodeURIComponent(m[1].trim());
      return JSON.parse(decoded);
    } catch (_) {}
  }

  return null;
}

async function fetchDouyinApi(itemId) {
  try {
    const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`;
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
        Referer: "https://www.douyin.com/",
      },
      timeout: 10000,
    });
    const d = res.data;
    if (d && d.item_list && d.item_list.length > 0) {
      return d.item_list[0];
    }
  } catch (_) {}
  return null;
}

function getItemFromData(data) {
  if (!data) return null;
  const loaderData = data.loaderData || {};
  for (const key in loaderData) {
    if (loaderData[key] && loaderData[key].videoInfoRes) {
      const itemList = loaderData[key].videoInfoRes.item_list;
      if (itemList && itemList.length > 0) return itemList[0];
    }
  }
  if (data.aweme && data.aweme.detail) return data.aweme.detail;
  if (data.item_list && data.item_list.length > 0) return data.item_list[0];
  if (data.aweme_detail) return data.aweme_detail;
  return null;
}

function buildResult(item) {
  const title = item.desc || item.share_info?.share_desc || "Douyin Content";
  const author = item.author ? item.author.nickname : "Douyin User";
  const thumbnail =
    item.video?.cover?.url_list?.[0] || item.images?.[0]?.url_list?.[0] || "";
  const downloads = [];

  if (item.images && item.images.length > 0) {
    item.images.forEach((img, i) => {
      const imgUrl = img.url_list?.[0] || img.download_url_list?.[0];
      if (imgUrl) {
        downloads.push({
          type: "image",
          quality: `Photo ${i + 1}`,
          url: imgUrl.replace(/^http:/, "https:"),
        });
      }
    });
  } else {
    let videoUrl =
      item.video?.play_addr?.url_list?.[0] ||
      item.video?.download_addr?.url_list?.[0];
    if (videoUrl) {
      videoUrl = videoUrl.replace(/^http:/, "https:").replace("playwm", "play");
      downloads.push({
        type: "video",
        quality: "HD No Watermark",
        url: videoUrl,
      });
    }
  }

  return {
    status: true,
    result: {
      title,
      author,
      thumbnail,
      type: item.images?.length ? "image" : "video",
      downloads,
    },
  };
}

async function scrape(url) {
  try {
    const cleanUrl = url.trim();
    let itemId = extractDouyinItemId(cleanUrl);

    if (itemId) {
      const apiItem = await fetchDouyinApi(itemId);
      if (apiItem) return buildResult(apiItem);
    }

    const mobileUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";

    const res = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": mobileUA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const finalUrl = res.request?.res?.responseUrl || cleanUrl;
    itemId = extractDouyinItemId(finalUrl) || extractDouyinItemId(res.data);
    if (itemId) {
      const apiItem = await fetchDouyinApi(itemId);
      if (apiItem) return buildResult(apiItem);
    }

    const parsedData = extractRouterOrSSRData(res.data);
    const item = getItemFromData(parsedData);
    if (item) return buildResult(item);

    throw new Error("Could not extract Douyin video data.");
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
