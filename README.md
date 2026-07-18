<div align="center">

# 📄 scrapr

**Lightweight Node.js library for resolving multimedia links through third-party scraping services. Built for easy integration into backend services, bots, and other applications.**

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![node version](https://img.shields.io/badge/node-%3E%3D%2016.x-61afef.svg?style=flat-square)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

---

[Key Features](#-key-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Response Schema](#-response-schema) • [API Reference](#-api-reference) • [Scraper Overview](#-scraper-overview) • [Issues & Requests](#-issues--requests)

</div>

## ✨ Key Features

- **Hybrid Scraper Engine:** Engineered with a modular design supporting ultra-fast, lightweight HTTP parsers (using `axios`, `cheerio`, and sandbox JavaScript runtime injection) while remaining fully compatible with browser automation drivers like Playwright and Puppeteer for robust fallbacks.
- **Unified JSON Schema:** All scrapers return a clean, normalized JSON format containing title, thumbnail, and media download links.
- **Platform Redundancy:** Multiple scrapers per platform (e.g. TikTok, Spotify, Twitter) to guarantee fallbacks when target sites change.
- **Fast Execution:** Responses resolve in milliseconds/seconds rather than waiting for browser execution trees.

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

## 🚀 Quick Start

Here is how simple it is to resolve a media URL with `scrapr`:

```javascript
const { tiktok, spotify } = require("scrapr");

(async () => {
  // 1. Scraping a TikTok video
  const tiktokRes = await tiktok.tiktokio(
    "https://www.tiktok.com/@_coflyn/video/7662892911448558865",
  );
  if (tiktokRes.status) {
    console.log("TikTok Video Found:", tiktokRes.result.title);
    console.log("Downloads:", tiktokRes.result.downloads);
  }

  // 2. Scraping a Spotify Track
  const spotifyRes = await spotify.spotmate(
    "https://open.spotify.com/track/5WOSNVChcadlsCRiqXE45K",
  );
  if (spotifyRes.status) {
    console.log("Spotify Audio Link:", spotifyRes.result.downloads[0].url);
  }
})();
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
    "type": "video", // "video" | "audio" | "image" | "album"
    "downloads": [
      {
        "url": "https://cdn.provider.com/file.mp4?expires=123",
        "type": "video", // "video" | "audio" | "image"
        "quality": "720p" // Optional, e.g., "320kbps", "HD", "1080p"
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

## 🔌 API Reference

| Platform                                                                                       | Method                                      | Source Site                |
| :--------------------------------------------------------------------------------------------- | :------------------------------------------ | :------------------------- |
| <img src="https://cdn.simpleicons.org/applemusic/FA576E" width="16" height="16" /> Apple Music | `applemusic.aplmate(url)`                   | aplmate.com                |
| <img src="https://cdn.simpleicons.org/bilibili/00AEEC" width="16" height="16" /> Bilibili      | `bilibili.snapwc(url)`                      | snapwc.com                 |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> Douyin          | `douyin.direct(url)`                        | direct page scrape         |
| <img src="https://cdn.simpleicons.org/soundcloud/FF5500" width="16" height="16" /> SoundCloud  | `soundcloud.klickaud(url)`                  | klickaud.org               |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> TikTok          | `tiktok.snaptik(url)`                       | snaptik.app                |
|                                                                                                | `tiktok.tiktokio(url)`                      | tiktokio.com               |
| <img src="https://cdn.simpleicons.org/youtube/FF0000" width="16" height="16" /> YouTube        | `youtube.ytmp3(url)`                        | ytmp3.mobi                 |
| <img src="https://cdn.simpleicons.org/instagram/E4405F" width="16" height="16" /> Instagram    | `instagram.indown(url)`                     | indown.io                  |
|                                                                                                | `instagram.downreels(url)`                  | downreels.com              |
| <img src="https://cdn.simpleicons.org/bandcamp/1DA1F2" width="16" height="16" /> Bandcamp      | `bandcamp.bandcampdownloader(url, options)` | bandcampdownloader.app     |
| <img src="https://cdn.simpleicons.org/spotify/1ED760" width="16" height="16" /> Spotify        | `spotify.spotmate(url)`                     | spotmate.online            |
|                                                                                                | `spotify.spotidown(url)`                    | spotidown.app              |
| <img src="https://cdn.simpleicons.org/x/000000" width="16" height="16" /> Twitter / X          | `twitter.tweeload(url)`                     | tweeload.com               |
|                                                                                                | `twitter.tvd(url)`                          | twittervideodownloader.com |

---

## 🔍 Scraper Overview

### Apple Music (`aplmate`)

Fast response (~3-5s). Relies on form submission with Turnstile bypass. Returns MP3 download URLs. Sometimes produces duplicate links or noise ("Download Another Song").

### Bilibili (`snapwc`)

Most complex scraper. Uses RSA key exchange + AES encryption for API communication. Requires multi-step session init and event logging. Returns muxed MP4 video with subtitles. Slower (~10-15s). Fails entirely if snapwc is down.

### Douyin (`direct`)

Pure page scrape without third-party service. Extracts video data from `window._ROUTER_DATA` using custom brace-balancing JSON parser. Returns both no-watermark and watermark variants. Fast (~3-5s). Most fragile — Douyin frequently changes page structure.

### SoundCloud (`klickaud`)

Worker-based scraping via SSE stream. Requires priming POST then waiting for worker completion. Slowest (~20-60s). Returns 128kbps MP3 only. No thumbnail or metadata. Worker may randomly fail on certain tracks.

### TikTok (`snaptik`)

Uses standard page fetching to retrieve a session token, then calls internal APIs. Dynamically evaluates obfuscated javascript response (`abc2.php`) via sandbox environment simulation to retrieve download URLs. Safe from IP-bans, but speed can vary depending on Snaptik's server stability.

### TikTok (`tiktokio`)

Uses direct POST requests to a JSON API endpoint. Extremely fast (~2-3s) and returns very detailed metadata (likes, comments, play count, slideshow images list, HD video, and audio). Handles photos/slideshows very well. Very clean output.

### YouTube (`ytmp3`)

Connects to ytmp3.mobi API. Requires an init handshake followed by polling a convert URL to monitor progress until the download link is ready. Reliable for both video (MP4) and audio (MP3). Polling adds slight latency (~6-10s total).

### Instagram (`indown`)

Murni Axios + Cheerio. Fetches a CSRF token and cookie from `indown.io`, then triggers a POST request to resolve the media URL. Resolves Instagram reels, videos, and images with good response speed (~4-6s). Does not require any headless browser runtime.

### Instagram (`downreels`)

Uses direct POST requests to downreels.com API (`zoraahub.com`). Fast response (~2-4s) returning direct links for videos, images, and audio along with thumbnails without the need for HTML parsing. Highly stable and lightweight.

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

---

## 💬 Issues & Requests

If you encounter any issues, broken scrapers, or request errors (which can happen frequently as source web pages update their endpoints), please open an issue.

You can also open an issue if you would like to request support for a new platform or scraper.

---

### 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
