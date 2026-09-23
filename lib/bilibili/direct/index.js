const axios = require("axios");

async function scrape(url) {
  try {
    const bvMatch = url.match(/(BV[a-zA-Z0-9]+)/i);
    const bvid = bvMatch ? bvMatch[1] : null;
    const avMatch = url.match(/(?:video\/av|[?&]aid=)(\d+)/i);
    const aid = avMatch ? avMatch[1] : null;

    if (!bvid && !aid) {
      throw new Error("Must be a valid Bilibili video URL (containing BV or AV id).");
    }

    const viewUrl = bvid
      ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      : `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;

    const headers = {
      Referer: "https://www.bilibili.com/",
      "User-Agent": "Bilibili/1.0",
    };

    const { data: viewRes } = await axios.get(viewUrl, { headers, timeout: 8000 });
    if (!viewRes || viewRes.code !== 0 || !viewRes.data) {
      throw new Error(viewRes?.message || "Failed to fetch video details from Bilibili API.");
    }

    const data = viewRes.data;
    const cid = data.cid || data.pages?.[0]?.cid;
    const effectiveBvid = data.bvid || bvid;

    if (!cid) {
      throw new Error("Could not find video cid from Bilibili API.");
    }

    const playUrl = `https://api.bilibili.com/x/player/playurl?bvid=${effectiveBvid}&cid=${cid}&qn=64`;
    const { data: playRes } = await axios.get(playUrl, { headers, timeout: 8000 });

    const durl = playRes?.data?.durl || [];
    const downloads = durl.map((item) => ({
      quality: "720p",
      type: "video",
      url: item.url,
    }));

    if (downloads.length === 0) {
      throw new Error("No download stream URLs returned from Bilibili API.");
    }

    return {
      status: true,
      result: {
        title: data.title || "Bilibili Video",
        thumbnail: data.pic || "",
        type: "video",
        author: {
          name: data.owner?.name || "Bilibili Creator",
          mid: data.owner?.mid,
        },
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
