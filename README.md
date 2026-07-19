<div align="center">

# 📐 scrapr

**Lightweight Node.js library for resolving multimedia links through third-party scraping services. Built for easy integration into backend services, bots, and other applications.**

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![node version](https://img.shields.io/badge/node-%3E%3D%2016.x-61afef.svg?style=flat-square)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

---

[Key Features](#-key-features) • [Prerequisites](#-prerequisites) • [Folder Structure](#-folder-structure) • [Installation](#-installation) • [Import Styles](#-import-styles) • [Quick Start](#-quick-start) • [Response Schema](#-response-schema) • [Configuration](#-configuration) • [Error Handling](#-error-handling) • [API Reference](#-api-reference) • [Performance](#-performance) • [Scraper Overview](#-scraper-overview) • [Contributing](#-contributing) • [Issues & Requests](#-issues--requests)

</div>

## ✨ Key Features

- **Modular Scraper Engine:** Lightweight HTTP parsers (`axios`, `cheerio`) for most platforms, with optional browser automation (Puppeteer, Playwright) for Cloudflare-bypassed scrapers.
- **Unified JSON Schema:** Every scraper speaks the same language — normalized response shape with title, thumbnail, type flags, and media download array.
- **Platform Redundancy:** Multiple scrapers per platform (TikTok ×4, Instagram ×3, YouTube, etc.) stacked as fallbacks when upstream services shift or go dark.
- **Sub-second Responses:** Direct API and page parsing instead of waiting for heavyweight browser render trees — most requests resolve in 2–6 seconds.

---

## 📋 Prerequisites

- **Node.js** >= 16.x
- **npm** or **yarn**

### Runtime Dependencies

| Dependency | Version | Purpose                      |
| ---------- | ------- | ---------------------------- |
| `axios`    | ^1.7.0  | HTTP client                  |
| `cheerio`  | ^1.0.0  | HTML parsing & DOM traversal |

### Optional — Headless Browser Fallback

Most scrapers use lightweight HTTP + DOM parsing only. Some scrapers require a browser for Cloudflare bypass:

```bash
# For savetik (TikTok) & fdown (Facebook) — requires Google Chrome installed
npm install puppeteer-core

# For snapinsta (Instagram)
npm install playwright-extra puppeteer-extra-plugin-stealth
npm install playwright  # browser binaries
```

---

## 📁 Folder Structure

```
scrapr/
├── index.js                  # Entry point — exports all platform modules
└── lib/
    ├── applemusic/
    │   └── aplmate/
    │       └── index.js
    ├── bandcamp/
    │   └── bandcampdownloader/
    │       └── index.js
    ├── bilibili/
    │   └── snapwc/
    │       └── index.js
    ├── douyin/
    │   └── direct/
    │       └── index.js
    ├── facebook/
    │   ├── snapsave/
    │   │   └── index.js
    │   └── fdown/
    │       └── index.js
    ├── instagram/
    │   ├── indown/
    │   │   └── index.js
    │   ├── downreels/
    │   │   └── index.js
    │   └── snapinsta/
    │       └── index.js
    ├── pinterest/
    │   └── pindown/
    │       └── index.js
    ├── soundcloud/
    │   └── klickaud/
    │       └── index.js
    ├── spotify/
    │   ├── spotmate/
    │   │   └── index.js
    │   └── spotidown/
    │       └── index.js
    ├── threads/
    │   └── threadster/
    │       └── index.js
    ├── tiktok/
    │   ├── snaptik/
    │   │   └── index.js
    │   ├── tiktokio/
    │   │   └── index.js
    │   ├── savetik/
    │   │   └── index.js
    │   └── ssstik/
    │       └── index.js
    ├── twitter/
    │   ├── tweeload/
    │   │   └── index.js
    │   └── tvd/
    │       └── index.js
    └── youtube/
        └── ytmp3/
            └── index.js
```

- Every scraper lives in `lib/<platform>/<method>/index.js`
- Each `<method>/` exports a single `{ scrape }` function
- `<platform>/index.js` re-exports all methods for that platform
- `index.js` at root pulls everything together

---

## 📦 Installation

Install the package directly from your repository URL:

```bash
npm install git+https://github.com/coflyn/scrapr.git
```

Or for local development / testing:

```bash
npm install /path/to/scrapr
```

---

## 📥 Import Styles

### CommonJS (default)

```js
const scrapr = require("scrapr");
// Or destructure individual platforms:
const { tiktok, spotify, twitter } = require("scrapr");
```

### ESM / TypeScript

```js
import scrapr from "scrapr";
import { tiktok, spotify } from "scrapr";
```

---

## 🚀 Quick Start

### Single Media Download

```javascript
const { tiktok, spotify } = require("scrapr");

(async () => {
  // 1. TikTok video
  const tiktokRes = await tiktok.tiktokio(
    "https://www.tiktok.com/@_coflyn/video/7662892911448558865",
  );
  if (tiktokRes.status) {
    console.log("Title:", tiktokRes.result.title);
    console.log("Downloads:", tiktokRes.result.downloads);
  }

  // 2. Spotify track
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

### Fallback Chain Pattern

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

## 📋 Response Schema

All scrapers resolve into a standardized JSON payload structure:

### Success Response

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

### Failure Response

```json
{
  "status": false,
  "message": "Error description / platform rate limit message"
}
```

---

## ⚙️ Configuration

### Global Timeout

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

## 🛠️ Error Handling

### Common Error Patterns

| Error                                 | Likely Cause                 | Fix                                |
| ------------------------------------- | ---------------------------- | ---------------------------------- |
| `Request failed with status code 4xx` | Upstream changed or blocked  | Try alternate scraper              |
| `Could not extract CSRF token`        | Page structure changed       | [Report issue](#-issues--requests) |
| `No download links found`             | Private content or dead link | Check URL accessibility            |
| `socket hang up` / `ETIMEDOUT`        | Network issue / rate limit   | Retry with delay or proxy          |
| `Cannot read properties of undefined` | Parser mismatch              | [Report issue](#-issues--requests) |

### Fallback Chain Pattern

```javascript
async function resolveInstagram(url) {
  const scrapers = [instagram.indown, instagram.downreels];
  for (const s of scrapers) {
    const res = await s(url);
    if (res.status) return res.result;
  }
  return null;
}
```

---

## 🔌 API Reference

| Platform                                                                                       | Method                                      | Source Site                |
| :--------------------------------------------------------------------------------------------- | :------------------------------------------ | :------------------------- |
| <img src="https://cdn.simpleicons.org/applemusic/FA576E" width="16" height="16" /> Apple Music | `applemusic.aplmate(url)`                   | aplmate.com                |
| <img src="https://cdn.simpleicons.org/bilibili/00AEEC" width="16" height="16" /> Bilibili      | `bilibili.snapwc(url)`                      | snapwc.com                 |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> Douyin          | `douyin.direct(url)`                        | direct page scrape         |
| <img src="https://cdn.simpleicons.org/facebook/1877F2" width="16" height="16" /> Facebook      | `facebook.snapsave(url)`                    | snapsave.app               |
|                                                                                                | `facebook.fdown(url)`                       | fdown.net                  |
| <img src="https://cdn.simpleicons.org/soundcloud/FF5500" width="16" height="16" /> SoundCloud  | `soundcloud.klickaud(url)`                  | klickaud.org               |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> TikTok          | `tiktok.snaptik(url)`                       | snaptik.app                |
|                                                                                                | `tiktok.tiktokio(url)`                      | tiktokio.com               |
|                                                                                                | `tiktok.savetik(url)`                       | savetik.co                 |
|                                                                                                | `tiktok.ssstik(url)`                        | ssstik.io                  |
| <img src="https://cdn.simpleicons.org/youtube/FF0000" width="16" height="16" /> YouTube        | `youtube.ytmp3(url)`                        | ytmp3.mobi                 |
| <img src="https://cdn.simpleicons.org/instagram/E4405F" width="16" height="16" /> Instagram    | `instagram.indown(url)`                     | indown.io                  |
|                                                                                                | `instagram.downreels(url)`                  | downreels.com              |
|                                                                                                | `instagram.snapinsta(url)`                  | snapinsta.to               |
| <img src="https://cdn.simpleicons.org/pinterest/E60023" width="16" height="16" /> Pinterest    | `pinterest.pindown(url)`                    | pindown.io                 |
| <img src="https://cdn.simpleicons.org/bandcamp/1DA1F2" width="16" height="16" /> Bandcamp      | `bandcamp.bandcampdownloader(url, options)` | bandcampdownloader.app     |
| <img src="https://cdn.simpleicons.org/spotify/1ED760" width="16" height="16" /> Spotify        | `spotify.spotmate(url)`                     | spotmate.online            |
|                                                                                                | `spotify.spotidown(url)`                    | spotidown.app              |
| <img src="https://cdn.simpleicons.org/x/000000" width="16" height="16" /> Twitter / X          | `twitter.tweeload(url)`                     | tweeload.com               |
|                                                                                                | `twitter.tvd(url)`                          | twittervideodownloader.com |
| <img src="https://cdn.simpleicons.org/threads/000000" width="16" height="16" /> Threads        | `threads.threadster(url)`                   | threadster.app             |

---

## ⏱️ Performance

| Platform    | Scraper              | Avg Time | Reliability | Notes                                     |
| ----------- | -------------------- | -------- | ----------- | ----------------------------------------- |
| Apple Music | `aplmate`            | ~3-5s    | ⚪ Medium   | Turnstile bypass, sometimes noise         |
| Bilibili    | `snapwc`             | ~10-15s  | 🟢 High     | RSA + AES handshake, fails if snapwc down |
| Douyin      | `direct`             | ~3-5s    | 🔴 Low      | Fragile — page structure changes often    |
| Facebook    | `snapsave`           | ~4-8s    | 🟢 High     | Packed JS unpacker, dual stream           |
| Facebook    | `fdown`              | ~8-15s   | 🟡 Medium   | Puppeteer + Chrome, Cloudflare bypass     |
| SoundCloud  | `klickaud`           | ~20-60s  | 🟡 Medium   | SSE worker, 128kbps only                  |
| TikTok      | `tiktokio`           | ~2-3s    | 🟢 High     | JSON API, rich metadata                   |
| TikTok      | `snaptik`            | ~3-5s    | 🟢 High     | Challenge-response AES, IP-safe           |
| TikTok      | `ssstik`             | ~2-4s    | 🟢 High     | Axios + Cheerio, HTMX polling             |
| TikTok      | `savetik`            | ~8-15s   | 🟡 Medium   | Puppeteer + Chrome, Cloudflare bypass     |
| YouTube     | `ytmp3`              | ~6-10s   | 🟢 High     | Init + poll, reliable                     |
| Instagram   | `indown`             | ~4-6s    | 🟢 High     | Axios + Cheerio, no browser               |
| Instagram   | `downreels`          | ~2-4s    | 🟢 High     | Direct API, lightweight                   |
| Instagram   | `snapinsta`          | ~10-20s  | 🟡 Medium   | Playwright + stealth, Turnstile bypass    |
| Pinterest   | `pindown`            | ~4-6s    | 🟢 High     | Token + API resolution                    |
| Bandcamp    | `bandcampdownloader` | ~5-15s   | 🟢 High     | Multi-track, 320kbps                      |
| Spotify     | `spotmate`           | ~3-5s    | 🟢 High     | CSRF + metadata                           |
| Spotify     | `spotidown`          | ~4-6s    | 🟡 Medium   | Cookie rotation                           |
| Twitter / X | `tweeload`           | ~3-5s    | 🟢 High     | Multi-quality                             |
| Twitter / X | `tvd`                | ~3-5s    | 🟢 High     | Direct CDN links                          |
| Threads     | `threadster`         | ~4-6s    | 🟢 High     | JWT token decode                          |

---

## 🔍 Scraper Overview

### Apple Music (`aplmate`)

Fast response (~3-5s). Relies on form submission with Turnstile bypass. Returns MP3 download URLs. Sometimes produces duplicate links or noise ("Download Another Song").

### Bilibili (`snapwc`)

Most complex scraper. Uses RSA key exchange + AES encryption for API communication. Requires multi-step session init and event logging. Returns muxed MP4 video with subtitles. Slower (~10-15s). Fails entirely if snapwc is down.

### Douyin (`direct`)

Pure page scrape without third-party service. Extracts video data from `window._ROUTER_DATA` using custom brace-balancing JSON parser. Returns both no-watermark and watermark variants. Fast (~3-5s). Most fragile — Douyin frequently changes page structure.

### Facebook (`snapsave`)

Uses `snapsave.app` backend with custom packed JS unpacker logic to decode download payloads. Returns high-resolution FB video URLs with and without audio streams.

### Facebook (`fdown`)

Uses Puppeteer + Chrome browser automation via `fdown.net` to bypass Cloudflare protection. Requires Google Chrome installed and `puppeteer-core` dependency. Returns SD and HD video download links. Runs in non-headless mode for reliability.

### TikTok (`snaptik`)

Uses a challenge-response API with AES-256-CBC decryption. Fetches an encrypted token from `/api/token`, decrypts it with a known salt + SHA256-derived key, then solves a dynamic math challenge (`b`, `r`, `c`, `m`, `n` types) to produce an `X-Verify` header. Returns rich metadata including author info, stats, and both normal + HD video URLs. Fast (~3-5s). Immune to IP bans — the challenge rotates per request.

### TikTok (`tiktokio`)

Uses direct POST requests to a JSON API endpoint. Extremely fast (~2-3s) and returns very detailed metadata (likes, comments, play count, slideshow images list, HD video, and audio). Handles photos/slideshows very well. Very clean output.

### TikTok (`ssstik`)

Axios + Cheerio scraper with HTMX-based token extraction. Fetches a session token from the homepage, then submits a POST via HTMX to resolve download links. Supports both video and photo/slideshow content. Returns watermarked and non-watermarked variants. Fast (~2-4s). No browser required.

### TikTok (`savetik`)

Puppeteer + Chrome automation via `savetik.co`. Requires Google Chrome installed and `puppeteer-core` dependency. Returns video and audio download links. Runs in non-headless mode for Cloudflare bypass.

### SoundCloud (`klickaud`)

Worker-based scraping via SSE stream. Requires priming POST then waiting for worker completion. Slowest (~20-60s). Returns 128kbps MP3 only. No thumbnail or metadata. Worker may randomly fail on certain tracks.

### YouTube (`ytmp3`)

Connects to ytmp3.mobi API. Requires an init handshake followed by polling a convert URL to monitor progress until the download link is ready. Reliable for both video (MP4) and audio (MP3). Polling adds slight latency (~6-10s total).

### Instagram (`indown`)

Murni Axios + Cheerio. Fetches a CSRF token and cookie from `indown.io`, then triggers a POST request to resolve the media URL. Resolves Instagram reels, videos, and images with good response speed (~4-6s). Does not require any headless browser runtime.

### Instagram (`downreels`)

Uses direct POST requests to downreels.com API (`zoraahub.com`). Fast response (~2-4s) returning direct links for videos, images, and audio along with thumbnails without the need for HTML parsing. Highly stable and lightweight.

### Instagram (`snapinsta`)

Playwright + stealth plugin automation via `snapinsta.to`. Uses headless Chromium to bypass Cloudflare Turnstile, fills form input, and waits for download links. Requires `playwright-extra` and `puppeteer-extra-plugin-stealth`. Slower (~10-20s) due to browser overhead.

### Pinterest (`pindown`)

Extracts session CSRF tokens and cookies from `pindown.io`, triggers backend action endpoints, and resolves intermediate API download tokens to return full high-res images and MP4 video downloads.

### Bandcamp (`bandcampdownloader`)

Uses `bandcampdownloader.app` backend. Resolves session cookies, extracts hidden CSRF tokens, parses a dynamically rendered base64 metadata array, and fires individual track requests. Supports single tracks as well as full albums/playlists with metadata (index, track title, artist, cover art, release year). Returns high-quality 320kbps MP3 download links.

### Spotify (`spotmate`)

Fetches a session cookie and CSRF token from `spotmate.online`, requests track metadata from `/getTrackData`, and triggers a track conversion via `/convert`. Fast response (~3-5s), returns standard MP3 downloads.

### Spotify (`spotidown`)

Uses `spotidown.app` backend. Triggers form actions with cookie rotation and returns single track downloads, album lists, or direct MP3 download buttons. Includes option for fetching high-resolution album cover arts.

### Twitter / X (`tweeload`)

POSTs target tweet URL to `/en/download` on `tweeload.com` using custom desktop user-agents. Highly reliable, returning multiple video download qualities (HD, SD, low-res) mapped via intermediate CDN download proxies.

### Twitter / X (`tvd`)

POSTs to `twittervideodownloader.com` using session middleware CSRF tokens and GraphQL metadata. Extracts original, direct `video.twimg.com` CDN links without intermediate download proxies, giving you the fastest direct download speeds.

### Threads (`threadster`)

Resolves Instagram Threads media (images and videos) via `threadster.app` backend with JWT token payload decoding for direct download links.

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-scraper`
3. Add your scraper under `lib/<platform>/<method>/index.js`
4. Export it in `lib/<platform>/index.js` and the root `index.js`
5. Follow the existing response schema (`{ status, result: { title, thumbnail, type, downloads } }`)
6. Open a pull request

### Guidelines

- Keep it lightweight — no puppeteer/playwright imports unless absolutely necessary
- Every scraper must return the standardized JSON schema
- Add a fallback scraper, don't replace existing ones
- Document quirks and failure modes in Scraper Overview

---

## 💬 Issues & Requests

If you encounter any issues, broken scrapers, or request errors (which can happen frequently as source web pages update their endpoints), please open an issue.

You can also open an issue if you would like to request support for a new platform or scraper.

---

## 📄 License

MIT - (c) 2026 coflyn
