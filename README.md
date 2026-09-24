<div align="center">

# scrapr

**Universal Social Media & Streaming Downloader for Node.js.**  
_Extract direct MP4, MP3, and image links from TikTok, Instagram, YouTube, Spotify, Twitter/X, and 10+ platforms._

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![node version](https://img.shields.io/badge/node-%3E%3D%2016.x-61afef.svg?style=flat-square)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

<br/>

<img src=".github/assets/banner.png" alt="scrapr banner" width="100%" />

<br/>
<br/>

`TikTok` • `Instagram` • `YouTube` • `Spotify` • `Twitter / X` • `Facebook` • `SoundCloud` • `Pinterest` • `Apple Music` • `Bilibili` • `Douyin` • `Bandcamp` • `Threads` • `Pixiv` • `RedNote`

<br/>

<a href="https://sociabuzz.com/coflyn/tribe" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" />
</a>

</div>

---

> **What is scrapr?** A media link extractor. Give it a social media or streaming URL and it returns direct downloadable links (MP4, MP3, images) with metadata. Not a general web crawler or HTML scraping toolkit.

---

## 📦 Installation

```bash
npm install git+https://github.com/coflyn/scrapr.git
```

For local development:

```bash
npm install /path/to/scrapr
```

---

## 🚀 Quick Start

### Single media

```javascript
const { tiktok, spotify } = require("scrapr");

(async () => {
  const tiktokRes = await tiktok.tiktokio(
    "https://www.tiktok.com/@_coflyn/video/7662892911448558865",
  );
  if (tiktokRes.status) {
    console.log("Title:", tiktokRes.result.title);
    console.log("Downloads:", tiktokRes.result.downloads);
  }

  const spotifyRes = await spotify.spotmate(
    "https://open.spotify.com/track/5WOSNVChcadlsCRiqXE45K",
  );
  if (spotifyRes.status) {
    console.log("Audio URL:", spotifyRes.result.downloads[0].url);
  }
})();
```

### Album / Playlist (Bandcamp)

```javascript
const { bandcamp } = require("scrapr");

(async () => {
  const res = await bandcamp.bandcampdownloader(
    "https://bandcamp.com/album/example",
    { quality: "320" }, // "128" | "320"
  );
  console.log(`${res.result.trackCount} tracks found`);
})();
```

### Fallback chain

```javascript
const { tiktok } = require("scrapr");

async function resolveTikTok(url) {
  const fallbacks = [tiktok.tiktokio, tiktok.snaptik];
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
const scrapr = require("scrapr");
const { tiktok, spotify, twitter } = require("scrapr");
```

### ESM

```js
import scrapr from "scrapr";
import { tiktok, spotify } from "scrapr";
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
|                                                                                                | `bilibili.snapwc(url)`                      | snapwc.com                     |
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
|                                                                                                | `instagram.indown(url)`                     | indown.io                      |
|                                                                                                | `instagram.downreels(url)`                  | downreels.com                  |
|                                                                                                | `instagram.snapsave(url)`                   | snapsave.app                   |
|                                                                                                | `instagram.snapinsta(url)`                  | snapinsta.to                   |
| <img src="https://cdn.simpleicons.org/pinterest/E60023" width="16" height="16" /> Pinterest    | `pinterest.direct(url)`                     | direct page scrape             |
|                                                                                                | `pinterest.pindown(url)`                    | pindown.io                     |
| <img src="https://cdn.simpleicons.org/bandcamp/1DA1F2" width="16" height="16" /> Bandcamp      | `bandcamp.bandcampdownloader(url, options)` | bandcampdownloader.app         |
| <img src="https://cdn.simpleicons.org/pixiv/0096FA" width="16" height="16" /> Pixiv            | `pixiv.ajax(url)`                           | pixiv.net (pixiv.re proxy)     |
| <img src="https://cdn.simpleicons.org/xiaohongshu/FF2442" width="16" height="16" /> RedNote    | `rednote.direct(url)`                       | xiaohongshu.com / rednote      |
| <img src="https://cdn.simpleicons.org/spotify/1ED760" width="16" height="16" /> Spotify        | `spotify.spotmate(url)`                     | spotmate.online                |
|                                                                                                | `spotify.spotidown(url)`                    | spotidown.app                  |
|                                                                                                | `spotify.soundloaders(url)`                 | soundloaders.app               |
| <img src="https://cdn.simpleicons.org/x/000000" width="16" height="16" /> Twitter / X          | `twitter.direct(url)`                       | api.fxtwitter.com              |
|                                                                                                | `twitter.tweeload(url)`                     | tweeload.com                   |
|                                                                                                | `twitter.tvd(url)`                          | twittervideodownloader.com     |
|                                                                                                | `twitter.savetwt(url)`                      | savetwt.com                    |
| <img src="https://cdn.simpleicons.org/threads/000000" width="16" height="16" /> Threads        | `threads.threadster(url)`                   | threadster.app                 |

---

## ⚡ Performance

| Platform    | Scraper              | Avg Time  | Reliability | Notes                                       |
| ----------- | -------------------- | --------- | ----------- | ------------------------------------------- |
| Apple Music | `aplmate`            | ~3-5s     | ⚪ Medium   | Turnstile bypass, sometimes noise           |
| Bilibili    | `direct`             | ~0.3-0.5s | 🟢 High     | Direct Bilibili view/playurl API            |
| Bilibili    | `snapwc`             | ~10-15s   | 🟡 Medium   | RSA + AES handshake to snapwc.com           |
| Douyin      | `direct`             | ~3-5s     | 🔴 Low      | Fragile: page structure changes often       |
| Facebook    | `snapsave`           | ~4-8s     | 🟢 High     | Packed JS unpacker, dual stream             |
| Facebook    | `fdown`              | ~8-15s    | 🟡 Medium   | Puppeteer + Chrome, Cloudflare bypass       |
| SoundCloud  | `klickaud`           | ~20-60s   | 🟡 Medium   | SSE worker, 128kbps only                    |
| TikTok      | `tiktokio`           | ~2-3s     | 🟢 High     | JSON API, rich metadata                     |
| TikTok      | `snaptik`            | ~3-5s     | 🟢 High     | Challenge-response AES, IP-safe             |
| TikTok      | `ssstik`             | ~2-4s     | 🟢 High     | Axios + Cheerio, HTMX polling               |
| TikTok      | `savetik`            | ~8-15s    | 🟡 Medium   | Puppeteer + Chrome, Cloudflare bypass       |
| YouTube     | `ytmp3`              | ~6-10s    | 🟢 High     | Init + poll, reliable                       |
| Instagram   | `direct`             | ~0.5-1s   | 🟢 High     | Native embed captioned JSON, zero 3rd party |
| Instagram   | `indown`             | ~4-6s     | 🟢 High     | Axios + Cheerio, no browser                 |
| Instagram   | `downreels`          | ~2-4s     | 🟢 High     | Direct API, lightweight                     |
| Instagram   | `snapinsta`          | ~10-20s   | 🟡 Medium   | Playwright + stealth, Turnstile bypass      |
| Pinterest   | `direct`             | ~0.5-1s   | 🟢 High     | Direct page parsing + pinimg extraction     |
| Pinterest   | `pindown`            | ~3-5s     | 🟡 Medium   | pindown.io token session                    |
| Bandcamp    | `bandcampdownloader` | ~2-4s     | 🟢 High     | Multi-track, 320kbps                        |
| Pixiv       | `ajax`               | ~0.4s     | 🟢 High     | Direct artwork metadata + pixiv.re proxy    |
| RedNote     | `direct`             | ~1-3s     | 🟢 High     | SSR state + OpenGraph parsing               |
| Spotify     | `spotmate`           | ~3-5s     | 🟢 High     | CSRF + metadata                             |
| Spotify     | `spotidown`          | ~4-6s     | 🟡 Medium   | Cookie rotation                             |
| Twitter / X | `direct`             | ~0.3-1s   | 🟢 High     | Direct FxTwitter CDN resolver               |
| Twitter / X | `tweeload`           | ~2-4s     | 🟢 High     | Multi-quality                               |
| Twitter / X | `tvd`                | ~3-8s     | 🟢 High     | Direct CDN links                            |
| Threads     | `threadster`         | ~2-4s     | 🟢 High     | JWT token decode                            |

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
# For savetik (TikTok) & fdown (Facebook) — requires Google Chrome installed
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
