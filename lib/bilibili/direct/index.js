const axios = require("axios");

async function scrape(url) {
  try {
    const cleanUrl = url.trim();

    // 1. Regional / International Bilibili (bilibili.tv)
    if (cleanUrl.includes("bilibili.tv")) {
      const urlObj = new URL(cleanUrl);
      const parts = urlObj.pathname.split("/").filter(Boolean);
      let apiInfo = null;
      let title = "Bilibili.tv Video";
      let thumbnail = "";

      const idxVideo = parts.indexOf("video");
      if (idxVideo !== -1) {
        const aid = parts[idxVideo + 1];
        if (aid && /^\d+$/.test(aid)) apiInfo = { tipo: "video", id: aid };
      }

      const idxPlay = parts.indexOf("play");
      if (idxPlay !== -1) {
        const numericParts = parts.slice(idxPlay + 1).filter((p) => /^\d+$/.test(p));
        if (numericParts.length > 1) {
          apiInfo = { tipo: "anime", id: numericParts[1] };
        } else if (numericParts.length === 1) {
          apiInfo = { tipo: "anime", id: null, seasonId: numericParts[0] };
        }
      }

      if (!apiInfo) {
        throw new Error("Could not parse Bilibili.tv video or episode ID.");
      }

      if (apiInfo.tipo === "anime" && !apiInfo.id && apiInfo.seasonId) {
        try {
          const { data: epData } = await axios.get(
            `https://api.bilibili.tv/intl/gateway/web/v2/ogv/play/episodes?season_id=${apiInfo.seasonId}&platform=web&s_locale=en_US`,
            { timeout: 8000 }
          );
          if (epData?.data?.sections?.[0]?.episodes?.[0]) {
            const firstEp = epData.data.sections[0].episodes[0];
            apiInfo.id = firstEp.episode_id || firstEp.ep_id || firstEp.id;
            title = firstEp.title_display || title;
            thumbnail = firstEp.cover || thumbnail;
          }
        } catch (_) {}
      }

      const downloads = [];
      if (apiInfo.tipo === "anime" && (apiInfo.id || apiInfo.seasonId)) {
        const param = apiInfo.id ? `ep_id=${apiInfo.id}` : `season_id=${apiInfo.seasonId}`;
        const { data: v2Data } = await axios.get(
          `https://api.bilibili.tv/intl/gateway/v2/ogv/playurl?${param}&platform=web&s_locale=en_US`,
          { timeout: 8000 }
        );
        const streamList = v2Data?.data?.video_info?.stream_list || [];
        streamList.forEach((s) => {
          const playUrl =
            s.url ||
            s.url_list?.[0]?.url ||
            s.dash_video?.base_url ||
            s.dash_video?.backup_url?.[0];
          if (playUrl) {
            const quality =
              s.stream_info?.display_desc ||
              s.stream_info?.description ||
              (s.quality ? `${s.quality}p` : "720p");
            downloads.push({
              quality,
              type: "video",
              url: playUrl.replace("http://", "https://"),
            });
          }
        });
      }

      if (downloads.length === 0) {
        throw new Error("No download streams returned from Bilibili.tv API.");
      }

      return {
        status: true,
        result: {
          title,
          thumbnail,
          type: "video",
          downloads,
        },
      };
    }

    // 2. Mainland Bilibili (bilibili.com / BV / AV)
    const bvMatch = cleanUrl.match(/(BV[a-zA-Z0-9]+)/i);
    const bvid = bvMatch ? bvMatch[1] : null;
    const avMatch = cleanUrl.match(/(?:video\/av|[?&]aid=)(\d+)/i);
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
