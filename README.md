<div align="center">

# scrapr

**Universal Media Extractor & Link Resolver for Node.js.**  
_Resolve direct media links, unshorten intermediate links, and extract downloadable streams across 20+ platforms._

[![npm version](https://img.shields.io/npm/v/@coflyn/scrapr.svg?style=flat-square)](https://www.npmjs.com/package/@coflyn/scrapr)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![node version](https://img.shields.io/badge/node-%3E%3D%2016.x-61afef.svg?style=flat-square)](https://nodejs.org)
[![platforms](https://img.shields.io/badge/platforms-23-brightgreen.svg?style=flat-square)](#-api-reference)
[![GitHub stars](https://img.shields.io/github/stars/coflyn/scrapr?style=flat-square)](https://github.com/coflyn/scrapr/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

<br/>

<img src=".github/assets/banner.png" alt="scrapr banner" width="100%" />

<br/>
<br/>

`TikTok` • `Instagram` • `YouTube` • `Spotify` • `Twitter / X` • `Facebook` • `SoundCloud` • `Pinterest` • `Apple Music` • `Bilibili` • `Douyin` • `Bandcamp` • `Threads` • `Pixiv` • `RedNote` • `Reddit` • `TeraBox` • `MediaFire` • `Sfile` • `Safelinku` • `Sub2Unlock` • `Rekonise` • `Unshorten`

<br/>

<a href="https://sociabuzz.com/coflyn/tribe" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" />
</a>

</div>

---

> **What is scrapr?** A lightweight media extractor and link resolver. Pass a social media, streaming, or shortlink URL and get direct downloadable streams (MP4, MP3, files) or destination URLs with structured metadata. Not a heavy web crawler or generic HTML scraping framework.

---

## 📦 Installation

```bash
npm install @coflyn/scrapr
```

Or install directly from GitHub:

```bash
npm install git+https://github.com/coflyn/scrapr.git
```

---

## 🚀 Quick Start

### Single media

```javascript
const { tiktok, twitter } = require("@coflyn/scrapr");

(async () => {
  const tiktokRes = await tiktok.snaptik(
    "https://www.tiktok.com/@_coflyn/video/7662892911448558865",
  );
  if (tiktokRes.status) {
    console.log("Title:", tiktokRes.result.title);
    console.log("Downloads:", tiktokRes.result.downloads);
  }

  const twitterRes = await twitter.direct(
    "https://twitter.com/Interior/status/463440424141459456",
  );
  if (twitterRes.status) {
    console.log("Media URL:", twitterRes.result.downloads[0].url);
  }
})();
```

### Album / Playlist (Bandcamp)

```javascript
const { bandcamp } = require("@coflyn/scrapr");

(async () => {
  // Direct track/album scraping (HTTP first)
  const direct = await bandcamp.direct("https://tycho.bandcamp.com/track/awake");
  console.log("Direct stream:", direct.result.downloads[0].url);

  // Downloader method with direct fallback
  const res = await bandcamp.bandcampdownloader(
    "https://tycho.bandcamp.com/album/awake",
    { quality: "320" },
  );
  console.log(`${res.result.trackCount} tracks found`);
})();
```

### Link Resolver (MediaFire, Sfile, Rekonise, Safelinku, Sub2Unlock, Unshorten)

```javascript
const { resolver } = require("@coflyn/scrapr");

(async () => {
  // Direct file host resolver
  const mf = await resolver.mediafire("https://www.mediafire.com/file/w4b1fjoijyug9qz/nix.py");
  console.log("MediaFire direct URL:", mf.result.url);

  // Social unlock resolvers (auto-resolves target MediaFire/Sfile link by default)
  const s2u = await resolver.sub2unlock("https://sub2unlock.io/example");
  console.log("Sub2Unlock destination URL:", s2u.result.url);

  const rek = await resolver.rekonise("https://rekonise.com/craniums-free-midi-kit-mlpp6");
  console.log("Rekonise unlocked URL:", rek.result.url);

  // Shortlink & gateway resolvers
  const sfl = await resolver.safelinku("https://sfl.gl/eMeqC");
  console.log("Safelinku direct file:", sfl.result.url);

  const raw = await resolver.unshorten("https://aka.ms/vscode");
  console.log("Unshortened URL:", raw.result.url);
})();
```

### Fallback chain

```javascript
const { tiktok } = require("@coflyn/scrapr");

async function resolveTikTok(url) {
  const fallbacks = [tiktok.snaptik, tiktok.ssstik];
  for (const scraper of fallbacks) {
    const res = await scraper(url);
    if (res.status) return res.result;
  }
  throw new Error("All TikTok scrapers failed");
}
```

---

## 📥 Import

### CommonJS

```js
const scrapr = require("@coflyn/scrapr");
const { tiktok, spotify, resolver } = require("@coflyn/scrapr");
```

### ESM

```js
import scrapr from "@coflyn/scrapr";
import { tiktok, spotify, resolver } = require("@coflyn/scrapr");
```

---

## 📋 Response Schema

### Single media

```json
{
  "status": true,
  "result": {
    "title": "Media Title / Song Name",
    "thumbnail": "https://cdn.example.com/cover.jpg",
    "type": "video",
    "downloads": [
      {
        "url": "https://cdn.provider.com/file.mp4?expires=123",
        "type": "video",
        "quality": "720p"
      }
    ]
  }
}
```

### Playlist / Album

For `youtube.playlist` and `bandcamp.bandcampdownloader`:

```json
{
  "status": true,
  "result": {
    "title": "Playlist or Album Title",
    "type": "playlist",
    "itemCount": 10,
    "items": [
      {
        "id": "dQw4w9WgXcQ",
        "title": "Track / Video Title",
        "author": "Artist or Channel Name",
        "thumbnail": "https://cdn.example.com/cover.jpg",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      }
    ]
  }
}
```

### Failure

```json
{
  "status": false,
  "message": "Error description / platform rate limit message"
}
```

---

## 🔌 API Reference

| Platform                                                                                       | Method                                      | Source Site                    |
| :--------------------------------------------------------------------------------------------- | :------------------------------------------ | :----------------------------- |
| <img src="https://cdn.simpleicons.org/applemusic/FA576E" width="16" height="16" /> Apple Music | `applemusic.aplmate(url)`                   | aplmate.com                    |
| <img src="https://cdn.simpleicons.org/bilibili/00AEEC" width="16" height="16" /> Bilibili      | `bilibili.direct(url)`                      | api.bilibili.com / bilibili.tv |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> Douyin          | `douyin.direct(url)`                        | direct page scrape             |
| <img src="https://cdn.simpleicons.org/facebook/1877F2" width="16" height="16" /> Facebook      | `facebook.snapsave(url)`                    | snapsave.app                   |
|                                                                                                | `facebook.fdown(url)`                       | fdown.net                      |
| <img src="https://cdn.simpleicons.org/soundcloud/FF5500" width="16" height="16" /> SoundCloud  | `soundcloud.klickaud(url)`                  | klickaud.org                   |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> TikTok          | `tiktok.snaptik(url)`                       | snaptik.app                    |
|                                                                                                | `tiktok.tiktokio(url)`                      | tiktokio.com                   |
|                                                                                                | `tiktok.savetik(url)`                       | savetik.co                     |
|                                                                                                | `tiktok.ssstik(url)`                        | ssstik.io                      |
|                                                                                                | `tiktok.tikdownloader(url)`                 | tikdownloader.io               |
| <img src="https://cdn.simpleicons.org/youtube/FF0000" width="16" height="16" /> YouTube        | `youtube.ytmp3(url)`                        | ytmp3.mobi                     |
|                                                                                                | `youtube.ytmp3gg(url)`                      | media.ytmp3.gg                 |
|                                                                                                | `youtube.playlist(url)`                     | youtube.com/playlist           |
| <img src="https://cdn.simpleicons.org/instagram/E4405F" width="16" height="16" /> Instagram    | `instagram.direct(url)`                     | direct embed scrape            |
|                                                                                                | `instagram.indown(url)`                     | indown.net                     |
|                                                                                                | `instagram.snapsave(url)`                   | snapsave.app                   |
|                                                                                                | `instagram.snapinsta(url)`                  | snapinsta.to                   |
| <img src="https://cdn.simpleicons.org/pinterest/E60023" width="16" height="16" /> Pinterest    | `pinterest.direct(url)`                     | direct page scrape             |
|                                                                                                | `pinterest.pindown(url)`                    | pindown.io                     |
| <img src="https://cdn.simpleicons.org/bandcamp/1DA1F2" width="16" height="16" /> Bandcamp      | `bandcamp.direct(url)`                      | direct page scrape             |
|                                                                                                | `bandcamp.bandcampdownloader(url, options)` | bandcampdownloader.app         |
| <img src="https://cdn.simpleicons.org/pixiv/0096FA" width="16" height="16" /> Pixiv            | `pixiv.ajax(url)`                           | pixiv.net (pixiv.re proxy)     |
| <img src="https://cdn.simpleicons.org/xiaohongshu/FF2442" width="16" height="16" /> RedNote    | `rednote.direct(url)`                       | xiaohongshu.com / rednote      |
| <img src="https://cdn.simpleicons.org/spotify/1ED760" width="16" height="16" /> Spotify        | `spotify.spotisaver(url)`                   | spotisaver.net                 |
|                                                                                                | `spotify.spotidown(url)`                    | spotidown.app                  |
|                                                                                                | `spotify.spotmate(url)`                     | spotmate.online                |
|                                                                                                | `spotify.soundloaders(url)`                 | soundloaders.app               |
| <img src="https://cdn.simpleicons.org/x/000000" width="16" height="16" /> Twitter / X          | `twitter.direct(url)`                       | api.fxtwitter.com              |
|                                                                                                | `twitter.tweeload(url)`                     | tweeload.com                   |
|                                                                                                | `twitter.tvd(url)`                          | twittervideodownloader.com     |
|                                                                                                | `twitter.savetwt(url)`                      | savetwt.com                    |
| <img src="https://cdn.simpleicons.org/threads/000000" width="16" height="16" /> Threads        | `threads.threadster(url)`                   | threadster.app                 |
| <img src="https://cdn.simpleicons.org/reddit/FF4500" width="16" height="16" /> Reddit          | `reddit.rapidsave(url)`                     | rapidsave.com                  |
| <img src="https://cdn.simpleicons.org/box/0061D5" width="16" height="16" /> TeraBox           | `terabox.sechno(url)`                       | sechno.com                     |
| Resolver (File Host & Shortlink)                                                               | `resolver.mediafire(url)`                   | mediafire.com                  |
|                                                                                                | `resolver.sfile(url)`                       | sfile.co / sfile.mobi          |
|                                                                                                | `resolver.sub2unlock(url, options)`         | sub2unlock.com / sub4unlock    |
|                                                                                                | `resolver.rekonise(url, options)`           | rekonise.com                   |
|                                                                                                | `resolver.safelinku(url, options)`          | safelinku.com / sfl.gl         |
|                                                                                                | `resolver.unshorten(url, options)`          | universal shortlinks (dub.sh, bit.ly, etc.) |

---

## ⚡ Performance

| Platform    | Scraper              | Avg Time  | Reliability | Notes                                       |
| ----------- | -------------------- | --------- | ----------- | ------------------------------------------- |
| Apple Music | `aplmate`            | ~3-5s     | ⚪ Medium   | Turnstile bypass, sometimes noise           |
| Bilibili    | `direct`             | ~0.3-0.5s | 🟢 High     | Direct Bilibili view/playurl API            |
| Douyin      | `direct`             | ~1-2s     | 🟢 High     | Direct iesdouyin SSR + ttwid handshake + WAF solver |
| Facebook    | `snapsave`           | ~4-8s     | 🟢 High     | Packed JS unpacker, dual stream             |
| Facebook    | `fdown`              | ~8-15s    | 🟡 Medium   | Puppeteer + Chrome, Cloudflare bypass       |
| SoundCloud  | `klickaud`           | ~4-6s     | 🟢 High     | Dynamic CSRF + SSE capability grant         |
| TikTok      | `tiktokio`           | ~1-2s     | 🟢 High     | JSON API, rich metadata                     |
| TikTok      | `snaptik`            | ~0.5-2s   | 🟢 High     | Challenge-response AES, IP-safe             |
| TikTok      | `ssstik`             | ~1-2s     | 🟢 High     | Axios + Cheerio, lightweight                |
| TikTok      | `savetik`            | ~5-8s     | 🟢 High     | High quality streams, active                |
| TikTok      | `tikdownloader`      | ~0.5-1s   | 🟢 High     | Direct tikdownloader.io extraction          |
| YouTube     | `ytmp3`              | ~6-10s    | 🟢 High     | Init + poll, reliable                       |
| YouTube     | `playlist`           | ~2-3s     | 🟢 High     | Parsed via ytInitialData lockupViewModel    |
| Instagram   | `direct`             | ~0.5-1s   | 🟢 High     | Native embed captioned JSON, zero 3rd party |
| Instagram   | `indown`             | ~1-2s     | 🟢 High     | Direct indown.net API, zero Cloudflare block|
| Instagram   | `snapsave`           | ~0.2-1s   | 🟢 High     | Obfuscated script unpacker & rapidcdn stream|
| Instagram   | `snapinsta`          | ~10-15s   | 🟢 High     | Playwright stealth + auto-detect system Chrome |
| Pinterest   | `direct`             | ~0.5-1s   | 🟢 High     | Direct page parsing + pinimg extraction     |
| Pinterest   | `pindown`            | ~1-2s     | 🟢 High     | AES-256-CBC challenge solver & dynamic seed |
| Bandcamp    | `direct`             | ~0.5-1s   | 🟢 High     | Direct Bandcamp tralbum data & stream extraction |
| Bandcamp    | `bandcampdownloader` | ~1-2s     | 🟢 High     | Token CSRF with direct fallback             |
| Pixiv       | `ajax`               | ~0.4s     | 🟢 High     | Official oEmbed + pixiv.re proxy fallback   |
| RedNote     | `direct`             | ~1-2s     | 🟢 High     | SSR state + OpenGraph parsing               |
| Reddit      | `rapidsave`          | ~1-2s     | 🟢 High     | RapidSave video + separate audio stream     |
| TeraBox     | `sechno`             | ~1-3s     | 🟢 High     | Direct download link + fast m3u8 streaming  |
| Resolver    | `mediafire`          | ~0.5-1.0s | 🟢 High     | Direct MediaFire button & CDN link resolver |
| Resolver    | `sfile`              | ~0.4-0.8s | 🟢 High     | Direct Sfile session & CDN resolver         |
| Resolver    | `sub2unlock`         | ~0.8-1.5s | 🟡 Medium   | Supports sub2unlock.io & sub2unlock.com     |
| Resolver    | `rekonise`           | ~11-13s   | 🟢 High     | Action handshake + server timer compliance  |
| Resolver    | `safelinku`          | ~2.5-4s   | 🟢 High     | Gateway API handshake & file auto-resolve   |
| Resolver    | `unshorten`          | ~0.5-1.5s | 🟢 High     | HTTP redirection chain & file auto-resolve  |
| Spotify     | `spotisaver`         | ~2s       | 🟢 High     | Fast signature handshake, direct MP3 stream |
| Spotify     | `spotidown`          | ~2-3s     | 🟢 High     | Token injection, supports albums/tracks      |
| Spotify     | `spotmate`           | ~4-6s     | 🟢 High     | Spotimate API with userverify handshake     |
| Spotify     | `soundloaders`       | ~3-5s     | 🟢 High     | Migrated to spotimate.app multipart stream  |
| Twitter / X | `direct`             | ~0.3-1s   | 🟢 High     | Direct FxTwitter CDN resolver               |
| Twitter / X | `tweeload`           | ~2-4s     | 🟢 High     | Multi-quality                               |
| Twitter / X | `tvd`                | ~0.5-2s   | 🟢 High     | TVD with direct FxTwitter fallback          |
| Twitter / X | `savetwt`            | ~0.5-2s   | 🟢 High     | SaveTWT with x.com normalization & fallback |
| Threads     | `threadster`         | ~2-4s     | 🟡 Medium   | Threadster API with JWT token decoding & cookie session |

---

## 🛠️ Error Handling

| Error                                 | Likely Cause                 | Fix                                |
| ------------------------------------- | ---------------------------- | ---------------------------------- |
| `Request failed with status code 4xx` | Upstream changed or blocked  | Try alternate scraper              |
| `Could not extract CSRF token`        | Page structure changed       | [Report issue](#-issues--requests) |
| `No download links found`             | Private content or dead link | Check URL accessibility            |
| `socket hang up` / `ETIMEDOUT`        | Network issue / rate limit   | Retry with delay or proxy          |
| `Cannot read properties of undefined` | Parser mismatch              | [Report issue](#-issues--requests) |

---

## ⚙️ Configuration

### Global timeout

```js
const axios = require("axios");
axios.defaults.timeout = 30000; // 30s
```

### Proxy

```js
const axios = require("axios");
const HttpsProxyAgent = require("https-proxy-agent");
axios.defaults.httpsAgent = new HttpsProxyAgent("http://proxy:8080");
```

---

## 🗂️ Folder Structure

```text
scrapr/
├── index.js                  # Entry point: exports all platform modules
└── lib/
    └── <platform>/           # Platform namespace (e.g. tiktok, instagram)
        ├── index.js          # Platform export aggregator
        └── <method>/         # Scraper implementation
            └── index.js      # Exports { scrape }
```

---

## 🧩 Prerequisites

- **Node.js** >= 16.x
- **npm** or **yarn**

### Runtime dependencies

| Dependency | Version | Purpose                      |
| ---------- | ------- | ---------------------------- |
| `axios`    | ^1.7.0  | HTTP client                  |
| `cheerio`  | ^1.0.0  | HTML parsing & DOM traversal |

### Optional: Headless browser fallback

Most scrapers use lightweight HTTP + DOM parsing only. Some require a browser for Cloudflare bypass:

```bash
# For savetik (TikTok) & fdown (Facebook): requires Google Chrome installed
npm install puppeteer-core

# For snapinsta (Instagram)
npm install playwright-extra puppeteer-extra-plugin-stealth
npm install playwright
```

---

## 🤝 Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details, response schemas, and verification instructions.

All contributors must adhere to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 🔒 Security

For security vulnerabilities and responsible disclosure, please refer to [SECURITY.md](SECURITY.md).

---

## 💬 Issues & Requests

If you encounter any issues, broken scrapers, or request errors (which can happen frequently as source web pages update their endpoints), please open an issue.

You can also open an issue to request support for a new platform or scraper.

---

## ⚖️ Disclaimer & Removal Requests

### Upstream disclaimer

This project is an open-source library that parses publicly available data. Source websites and third-party APIs can modify their markup, anti-bot mechanisms, or rate limits at any time.

### Service owner takedown policy

If you are the owner, operator, or authorized representative of any website or service supported in this project and would like your service removed from this repository, please [open an issue](https://github.com/coflyn/scrapr/issues) with the title prefix `[Removal Request]`. We respect website operators and will promptly honor removal requests.

---

## 📄 License

MIT - (c) 2026 coflyn
