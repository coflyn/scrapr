const assert = require("assert");
const scrapr = require("../index");

const SAMPLES = {
  tiktok: {
    url: "https://www.tiktok.com/@starxcean/video/7641620679846153492",
    methods: ["snaptik", "tiktokio", "ssstik", "savetik"],
  },
  youtube: {
    url: "https://youtu.be/RxiTWxP9Xf4",
    methods: ["ytmp3"],
  },
  instagram: {
    url: "https://www.instagram.com/p/Dc8-_DptXHe/",
    methods: ["direct", "indown", "downreels", "snapinsta"],
  },
  twitter: {
    url: "https://x.com/Interior/status/463440424141459456",
    methods: ["direct", "tweeload", "tvd"],
  },
  spotify: {
    url: "https://open.spotify.com/track/2FZIabCRMEWAYfN69Ijn1U?si=2d77949e6a3541d3",
    methods: ["spotmate", "spotidown"],
  },
  bandcamp: {
    url: "https://tycho.bandcamp.com/track/awake",
    methods: ["bandcampdownloader"],
  },
  pinterest: {
    url: "https://www.pinterest.com/pin/1012606416174246835/",
    methods: ["direct", "pindown"],
  },
  threads: {
    url: "https://www.threads.net/@zuck/post/CuW6T7kP74f",
    methods: ["threadster"],
  },
  applemusic: {
    url: "https://music.apple.com/us/album/never-gonna-give-you-up/1559523357?i=1559523359",
    methods: ["aplmate"],
  },
  soundcloud: {
    url: "https://soundcloud.com/octobersveryown/drake-gods-plan",
    methods: ["klickaud"],
  },
  facebook: {
    url: "https://www.facebook.com/watch/?v=10153231379946729",
    methods: ["snapsave", "fdown"],
  },
  douyin: {
    url: "https://v.douyin.com/i8N5B1C/",
    methods: ["direct"],
  },
  bilibili: {
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    methods: ["direct", "snapwc"],
  },
  pixiv: {
    url: "https://www.pixiv.net/en/artworks/115986071",
    methods: ["ajax"],
  },
  rednote: {
    url: "https://www.xiaohongshu.com/explore/65e94b29000000000b032d67",
    methods: ["direct"],
  },
};

function validateSchema(payload) {
  assert.strictEqual(typeof payload, "object", "Payload must be object");
  assert.strictEqual(
    typeof payload.status,
    "boolean",
    "payload.status must be boolean",
  );

  if (payload.status) {
    assert.ok(
      payload.result && typeof payload.result === "object",
      "payload.result must exist",
    );
    assert.strictEqual(
      typeof payload.result.title,
      "string",
      "result.title must be string",
    );
    const hasMedia =
      Array.isArray(payload.result.downloads) ||
      Array.isArray(payload.result.tracks) ||
      typeof payload.result.download === "string" ||
      typeof payload.result.url === "string";
    assert.ok(
      hasMedia,
      "result must contain downloads, tracks, or download link",
    );
  }
}

async function run() {
  const targets = process.argv.slice(2).map((t) => t.toLowerCase());
  const entries = Object.entries(SAMPLES).filter(
    ([platform]) => targets.length === 0 || targets.includes(platform),
  );

  if (entries.length === 0) {
    console.error(`Target platform "${target}" not found.`);
    process.exit(1);
  }

  console.log(`Running scraper checks (${entries.length} platforms)...\n`);

  let resolved = 0;
  let upstreamErrors = 0;
  let crashes = 0;
  let skipped = 0;

  for (const [platform, config] of entries) {
    for (const method of config.methods) {
      const fn = scrapr[platform]?.[method];
      if (typeof fn !== "function") {
        console.log(`[-] ${platform}.${method}: SKIPPED (method not exported)`);
        skipped++;
        continue;
      }

      const start = Date.now();
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout (15s exceeded)")), 15000),
        );
        const res = await Promise.race([fn(config.url), timeoutPromise]);
        validateSchema(res);
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        if (res.status) {
          console.log(`\n[+] ${platform}.${method}: RESOLVED (${elapsed}s)`);
          console.dir(res, { depth: 4, colors: true });
          resolved++;
        } else {
          console.log(
            `\n[!] ${platform}.${method}: UPSTREAM_ERR (${elapsed}s) -> ${res.message || "Failed"}`,
          );
          console.dir(res, { depth: 4, colors: true });
          upstreamErrors++;
        }
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.log(
          `\n[x] ${platform}.${method}: CRASH (${elapsed}s) -> ${err.message}`,
        );
        crashes++;
      }
    }
  }

  console.log(
    `\nSummary: ${resolved} resolved, ${upstreamErrors} upstream errors, ${crashes} crashes, ${skipped} skipped.`,
  );
}

run();
