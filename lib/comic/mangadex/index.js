const axios = require("axios");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid MangaDex URL.");
    }

    const cleanUrl = url.trim();
    const uuidMatch = cleanUrl.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (!uuidMatch) {
      throw new Error("No UUID found in MangaDex URL.");
    }

    let chapterId = uuidMatch[0];

    // If manga title URL passed, resolve latest chapter
    if (cleanUrl.includes("/title/")) {
      const listRes = await axios.get(
        `https://api.mangadex.org/chapter?manga=${chapterId}&limit=1&order[chapter]=desc`,
        { headers: { "User-Agent": UA }, timeout: 10000 }
      );
      const latestCh = listRes.data?.data?.[0];
      if (!latestCh) {
        throw new Error("No readable chapters found for this MangaDex title.");
      }
      chapterId = latestCh.id;
    }

    const chRes = await axios.get(
      `https://api.mangadex.org/chapter/${chapterId}?includes[]=manga&includes[]=scanlation_group&includes[]=user`,
      { headers: { "User-Agent": UA }, timeout: 10000 }
    );
    const chData = chRes.data?.data;
    if (!chData) {
      throw new Error("MangaDex chapter metadata not found.");
    }

    const mangaRel = chData.relationships?.find((r) => r.type === "manga");
    const groupRel = chData.relationships?.find(
      (r) => r.type === "scanlation_group"
    );

    let mangaTitle = "";
    if (mangaRel?.attributes?.title) {
      const titles = mangaRel.attributes.title;
      mangaTitle =
        titles.en || titles["ja-ro"] || Object.values(titles)[0] || "";
    }

    const chNum = chData.attributes?.chapter || "";
    const chTitle = chData.attributes?.title || "";
    const titleParts = [];
    if (mangaTitle) titleParts.push(mangaTitle);
    if (chNum) titleParts.push(`Chapter ${chNum}`);
    if (chTitle) titleParts.push(chTitle);
    const title = titleParts.join(" - ") || "MangaDex Chapter";

    const author =
      groupRel?.attributes?.name || mangaTitle || "MangaDex";

    const atHomeRes = await axios.get(
      `https://api.mangadex.org/at-home/server/${chapterId}`,
      { headers: { "User-Agent": UA }, timeout: 10000 }
    );
    const atHome = atHomeRes.data;
    if (!atHome?.baseUrl || !atHome?.chapter?.data) {
      throw new Error("Could not retrieve MangaDex@Home server node.");
    }

    const baseUrl = atHome.baseUrl;
    const hash = atHome.chapter.hash;
    const files = atHome.chapter.data;

    const downloads = files.map((file, i) => ({
      type: "photo",
      quality: `Page ${i + 1}`,
      url: `${baseUrl}/data/${hash}/${file}`,
    }));

    return {
      status: true,
      result: {
        title,
        author,
        thumbnail: downloads[0]?.url || "",
        type: "photo",
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

scrape.scrape = scrape;
scrape.api = scrape;
scrape.direct = scrape;

module.exports = scrape;
