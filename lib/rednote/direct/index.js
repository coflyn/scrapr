const axios = require("axios");

const CHROME_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const CHROME_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isLandingOrErrorPage(title, imgUrl) {
  const invalidTitles = [
    "你的生活兴趣社区",
    "你访问的页面不见了",
    "页面不见了",
    "404 Not Found",
    "Page Not Found",
  ];
  if (title && invalidTitles.some((t) => title.includes(t))) return true;
  if (
    imgUrl &&
    (imgUrl.includes("e6214e4fbfae2cf14d634d4296916e8a5eaefdf4") ||
      imgUrl.includes("fe-platform"))
  ) {
    return true;
  }
  return false;
}

function findNoteObjectFromState(state) {
  if (!state) return null;

  if (state.noteData?.data?.noteData) {
    const nd = state.noteData.data.noteData;
    if (nd.title || nd.desc || nd.imageList || nd.video) return nd;
  }

  if (state.note?.noteDetailMap) {
    const map = state.note.noteDetailMap;
    for (const k of Object.keys(map)) {
      const item = map[k]?.note || map[k];
      if (item && !Array.isArray(item) && (item.title || item.desc || item.imageList || item.video)) {
        return item;
      }
    }
  }

  const alt = [
    state.noteData?.note,
    state.noteData,
    state.note?.firstNote,
    state.feed?.note,
    state.firstNote,
  ];
  for (const cand of alt) {
    if (cand && !Array.isArray(cand) && (cand.title || cand.desc || cand.imageList || cand.video)) {
      return cand;
    }
  }

  return null;
}

function extractMediaFromHtml(htmlContent, sourceUrl) {
  const htmlStr = typeof htmlContent === "string" ? htmlContent : "";

  const matchState =
    htmlStr.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/);

  if (matchState) {
    try {
      const rawJson = matchState[1]
        .replace(/;\s*$/, "")
        .replace(/:\s*undefined/g, ":null");
      const state = JSON.parse(rawJson);
      const noteData = findNoteObjectFromState(state);

      if (noteData) {
        const title = noteData.title || noteData.desc || "RedNote Post";
        const author =
          noteData.user?.nickname ||
          noteData.user?.nickName ||
          "RedNote Creator";
        let thumbnail = "";
        const downloads = [];

        if (noteData.imageList && noteData.imageList.length > 0) {
          const firstImg =
            noteData.imageList[0].urlDefault ||
            noteData.imageList[0].urlOriginal ||
            noteData.imageList[0].url;
          if (firstImg) thumbnail = firstImg.startsWith("//") ? `https:${firstImg}` : firstImg;
        }

        if (!isLandingOrErrorPage(title, thumbnail)) {
          if (noteData.video && noteData.video.media) {
            const streamObj = noteData.video.media.stream || {};
            let videoUrl = null;
            const codecs = ["h264", "h265", "h266", "av1"];

            for (const c of codecs) {
              if (Array.isArray(streamObj[c]) && streamObj[c].length > 0) {
                const firstStream = streamObj[c][0];
                videoUrl =
                  firstStream.masterUrl ||
                  firstStream.backupUrls?.[0] ||
                  firstStream.url;
                if (videoUrl) break;
              }
            }

            if (!videoUrl && noteData.video.media.video) {
              videoUrl = noteData.video.media.video.masterUrl;
            }

            if (videoUrl) {
              if (videoUrl.startsWith("//")) videoUrl = `https:${videoUrl}`;
              downloads.push({
                type: "video",
                quality: "HD Video",
                url: videoUrl,
              });
            }
          }

          if (noteData.imageList && noteData.imageList.length > 0) {
            noteData.imageList.forEach((img, i) => {
              let u = img.urlOriginal || img.urlDefault || img.url;
              if (u) {
                if (u.startsWith("//")) u = `https:${u}`;
                downloads.push({
                  type: "image",
                  quality: `Photo ${i + 1}`,
                  url: u,
                });
              }
            });
          }

          if (downloads.length > 0) {
            return {
              title,
              thumbnail: thumbnail || downloads[0].url,
              type: noteData.video ? "video" : "image",
              author: { name: author },
              downloads,
            };
          }
        }
      }
    } catch (_) {}
  }

  // OpenGraph Fallback
  const ogTitleMatch =
    htmlStr.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    htmlStr.match(/<meta\s+name="og:title"\s+content="([^"]+)"/i) ||
    htmlStr.match(/<title>([^<]+)<\/title>/i);
  const ogImageMatch =
    htmlStr.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    htmlStr.match(/<meta\s+name="og:image"\s+content="([^"]+)"/i);
  const ogVideoMatch =
    htmlStr.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
    htmlStr.match(/<meta\s+property="og:video:url"\s+content="([^"]+)"/i);

  let rawTitle = ogTitleMatch ? ogTitleMatch[1] : "";
  let rawImage = ogImageMatch ? ogImageMatch[1] : "";
  if (rawImage.startsWith("//")) rawImage = `https:${rawImage}`;

  if (!isLandingOrErrorPage(rawTitle, rawImage) && (ogImageMatch || ogVideoMatch)) {
    const title =
      rawTitle.replace(/ - (?:小红书|RedNote).*/i, "").trim() || "RedNote Post";
    const downloads = [];
    if (ogVideoMatch) {
      let vUrl = ogVideoMatch[1];
      if (vUrl.startsWith("//")) vUrl = `https:${vUrl}`;
      downloads.push({ type: "video", quality: "HD Video", url: vUrl });
    }
    if (ogImageMatch && rawImage) {
      downloads.push({ type: "image", quality: "Photo", url: rawImage });
    }
    if (downloads.length > 0) {
      return {
        title,
        thumbnail: rawImage || downloads[0].url,
        type: ogVideoMatch ? "video" : "image",
        author: { name: "RedNote Creator" },
        downloads,
      };
    }
  }

  return null;
}

async function scrape(url) {
  try {
    const cleanUrlMatch = url.match(/https?:\/\/[^\s]+/i);
    let cleanUrl = cleanUrlMatch ? cleanUrlMatch[0] : url;

    let extractedNoteId = null;
    const userAgentsToTry = [CHROME_DESKTOP_UA, CHROME_MOBILE_UA];

    // Handle short links: xhslink.com or xhslink.cn
    if (cleanUrl.includes("xhslink.com") || cleanUrl.includes("xhslink.cn")) {
      for (const ua of userAgentsToTry) {
        try {
          const redirectRes = await axios.get(cleanUrl, {
            headers: { "User-Agent": ua },
            maxRedirects: 5,
            timeout: 10000,
          });

          const resHtml = typeof redirectRes.data === "string" ? redirectRes.data : "";
          const extracted = extractMediaFromHtml(resHtml, cleanUrl);
          if (extracted) {
            return { status: true, result: extracted };
          }

          const locationHdr = redirectRes.headers?.location || "";
          const targetSearchStr = `${redirectRes.request?.res?.responseUrl || ""} ${locationHdr} ${resHtml}`;
          const noteIdMatch = targetSearchStr.match(/\/([a-f0-9]{24})/i);
          if (noteIdMatch) extractedNoteId = noteIdMatch[1];

          if (redirectRes.request?.res?.responseUrl && !redirectRes.request.res.responseUrl.includes("xhslink.com")) {
            cleanUrl = redirectRes.request.res.responseUrl;
            break;
          }
        } catch (_) {}
      }
    }

    if (!extractedNoteId) {
      const noteIdMatch =
        cleanUrl.match(/\/(?:explore|discovery\/item|red_video)\/([a-f0-9]{24})/i) ||
        cleanUrl.match(/\/([a-f0-9]{24})/i);
      if (noteIdMatch) extractedNoteId = noteIdMatch[1];
    }

    const urlsToTry = [];
    if (cleanUrl && !cleanUrl.includes("xhslink.com") && !cleanUrl.includes("xhslink.cn")) {
      urlsToTry.push(cleanUrl);
    }
    if (extractedNoteId) {
      urlsToTry.push(`https://www.xiaohongshu.com/discovery/item/${extractedNoteId}`);
      urlsToTry.push(`https://www.xiaohongshu.com/explore/${extractedNoteId}`);
      urlsToTry.push(`https://www.rednote.com/discovery/item/${extractedNoteId}`);
      urlsToTry.push(`https://www.rednote.com/explore/${extractedNoteId}`);
    }

    for (const targetUrl of urlsToTry) {
      for (const ua of userAgentsToTry) {
        try {
          const res = await axios.get(targetUrl, {
            headers: {
              "User-Agent": ua,
              Cookie: "a1=18a1234567890abcdef1234567890abc; webId=1234567890abcdef",
              "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            timeout: 10000,
            maxRedirects: 5,
          });

          const extracted = extractMediaFromHtml(res.data, targetUrl);
          if (extracted) {
            return { status: true, result: extracted };
          }
        } catch (_) {}
      }
    }

    throw new Error("RedNote post not found or link has expired.");
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
