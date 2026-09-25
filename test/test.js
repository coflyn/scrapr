const assert = require("assert");
const scrapr = require("../index");

const SAMPLES = {
  tiktok: {
    url: "https://www.tiktok.com/@starxcean/video/7641620679846153492",
    methods: ["snaptik", "tiktokio", "ssstik", "savetik", "tikdownloader"],
  },
  youtube: {
    url: "https://youtu.be/RxiTWxP9Xf4",
    playlistUrl:
      "https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9n14-",
    methods: ["ytmp3", "ytmp3gg", "playlist"],
  },
  instagram: {
    url: "https://www.instagram.com/p/Dc8-_DptXHe/",
    methods: ["direct", "indown", "downreels", "snapsave", "snapinsta"],
  },
  twitter: {
    url: "https://x.com/Interior/status/463440424141459456",
    methods: ["direct", "tweeload", "tvd", "savetwt"],
  },
  spotify: {
    url: "https://open.spotify.com/track/2FZIabCRMEWAYfN69Ijn1U?si=2d77949e6a3541d3",
    methods: ["spotmate", "spotidown", "soundloaders"],
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
    url: "https://v.douyin.com/o-P-4yQzt5c/",
    methods: ["direct"],
  },
  bilibili: {
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    methods: ["direct"],
  },
  pixiv: {
    url: "https://www.pixiv.net/en/artworks/150068059",
    methods: ["ajax"],
  },
  rednote: {
    url: "https://www.rednote.com/discovery/item/6a6b303000000000320207f9",
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
      Array.isArray(payload.result.items) ||
      typeof payload.result.download === "string" ||
      typeof payload.result.url === "string";
    assert.ok(
      hasMedia,
      "result must contain downloads, tracks, items, or download link",
    );
  }
}

async function run() {
  const rawArgs = process.argv
    .slice(2)
    .filter((a) => a !== "--")
    .map((t) => t.toLowerCase());

  const tasks = [];
  if (rawArgs.length === 0) {
    for (const [platform, config] of Object.entries(SAMPLES)) {
      for (const method of config.methods) {
        tasks.push({ platform, method, config });
      }
    }
  } else {
    for (const arg of rawArgs) {
      if (arg.includes("/") || arg.includes(".")) {
        const [plat, meth] = arg.split(/[\/\.]/);
        const config = SAMPLES[plat];
        if (
          config &&
          (config.methods.includes(meth) ||
            typeof scrapr[plat]?.[meth] === "function")
        ) {
          tasks.push({ platform: plat, method: meth, config });
        } else {
          console.error(`Scraper target "${arg}" not found.`);
          process.exit(1);
        }
      } else if (SAMPLES[arg]) {
        for (const method of SAMPLES[arg].methods) {
          tasks.push({ platform: arg, method, config: SAMPLES[arg] });
        }
      } else {
        let found = false;
        for (const [platform, config] of Object.entries(SAMPLES)) {
          if (
            config.methods.includes(arg) ||
            typeof scrapr[platform]?.[arg] === "function"
          ) {
            tasks.push({ platform, method: arg, config });
            found = true;
          }
        }
        if (!found) {
          console.error(
            `Target "${arg}" not found (expected platform or platform/method).`,
          );
          process.exit(1);
        }
      }
    }
  }

  if (tasks.length === 0) {
    console.error("No valid test targets found.");
    process.exit(1);
  }

  console.log(`Running scraper checks (${tasks.length} tests)...\n`);

  let resolved = 0;
  let upstreamErrors = 0;
  let crashes = 0;
  let skipped = 0;

  for (const { platform, method, config } of tasks) {
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
      const testUrl =
        method === "playlist" && config.playlistUrl
          ? config.playlistUrl
          : config.url;
      const res = await Promise.race([fn(testUrl), timeoutPromise]);
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

  console.log(
    `\nSummary: ${resolved} resolved, ${upstreamErrors} upstream errors, ${crashes} crashes, ${skipped} skipped.`,
  );
}

run();
