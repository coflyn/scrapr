const axios = require("axios");

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let num = Number(bytes);
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(2)} ${units[i]}`;
}

async function scrape(url) {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid Pixeldrain URL or ID.");
    }

    const idMatch =
      url.match(
        /pixeldrain\.com\/(?:u|d|l|api\/file|api\/filesystem)\/([a-zA-Z0-9_-]+)/i,
      ) || url.match(/^([a-zA-Z0-9_-]{6,16})$/);

    if (!idMatch) throw new Error("Invalid Pixeldrain URL or ID.");
    const id = idMatch[1];
    const isFs = url.includes("/d/") || url.includes("/filesystem/");
    const isList = url.includes("/l/") || url.includes("/list/");

    if (isList) {
      const res = await axios.get(`https://pixeldrain.com/api/list/${id}`, {
        timeout: 15000,
      });
      const data = res.data;
      if (!data || !data.success) throw new Error("Pixeldrain list not found.");
      return {
        status: true,
        result: {
          title: data.title || "Pixeldrain Album",
          type: "album",
          trackCount: data.files?.length || 0,
          downloads: (data.files || []).map((f) => ({
            type: "file",
            filename: f.name,
            size: formatBytes(f.size),
            url: `https://pixeldrain.com/api/file/${f.id}?download`,
          })),
        },
      };
    }

    if (isFs) {
      const res = await axios.get(
        `https://pixeldrain.com/api/filesystem/${id}?stat`,
        { timeout: 15000 },
      );
      const data = res.data;
      const file = data?.path?.[data?.base_index ?? 0];
      if (!file) throw new Error("Pixeldrain file not found.");
      const directUrl = `https://pixeldrain.com/api/filesystem${file.path || "/" + id}?attach`;
      return {
        status: true,
        result: {
          title: file.name || "Pixeldrain File",
          filename: file.name,
          size: formatBytes(file.file_size),
          url: directUrl,
          downloads: [
            { type: "file", quality: "Direct Download", url: directUrl },
          ],
        },
      };
    }

    // Default: try /api/file/{id}/info first
    try {
      const res = await axios.get(
        `https://pixeldrain.com/api/file/${id}/info`,
        { timeout: 15000 },
      );
      const data = res.data;
      if (data && data.success) {
        const directUrl = `https://pixeldrain.com/api/file/${id}?download`;
        return {
          status: true,
          result: {
            title: data.name || "Pixeldrain File",
            filename: data.name,
            size: formatBytes(data.size),
            url: directUrl,
            downloads: [
              { type: "file", quality: "Direct Download", url: directUrl },
            ],
          },
        };
      }
    } catch (_) {}

    // Fallback: try filesystem stat
    const fsRes = await axios.get(
      `https://pixeldrain.com/api/filesystem/${id}?stat`,
      { timeout: 15000 },
    );
    const fsData = fsRes.data;
    const file = fsData?.path?.[fsData?.base_index ?? 0];
    if (!file) throw new Error("Pixeldrain file not found.");
    const directUrl = `https://pixeldrain.com/api/filesystem${file.path || "/" + id}?attach`;
    return {
      status: true,
      result: {
        title: file.name || "Pixeldrain File",
        filename: file.name,
        size: formatBytes(file.file_size),
        url: directUrl,
        downloads: [
          { type: "file", quality: "Direct Download", url: directUrl },
        ],
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message || "Failed to resolve Pixeldrain link.",
    };
  }
}

module.exports = { scrape };
