# scrapr

Lightweight Node.js library for resolving multimedia links through third-party scraping services. Built for easy integration into backend services, bots, and other applications.

## Usage

```js
const { applemusic, bilibili, douyin, soundcloud, tiktok, youtube, instagram, bandcamp } = require("scrapr");

// Example using TikTok's tiktokio scraper
const res = await tiktok.tiktokio("https://www.tiktok.com/@...");
if (res.status) {
  console.log(res.result.title);
  console.log(res.result.downloads);
} else {
  console.error(res.message);
}
```

## Response Schema

### Success

```json
{
  "status": true,
  "result": {
    "title": "Media Title",
    "thumbnail": "https://...",
    "downloads": [
      {
        "url": "https://...",
        "type": "audio",
        "quality": "128kbps"
      }
    ]
  }
}
```

### Failure

```json
{
  "status": false,
  "message": "Error description"
}
```

## API

| Platform | Scraper Method | Source |
|----------|----------------|--------|
| <img src="https://cdn.simpleicons.org/applemusic/FA576E" width="16" height="16" /> Apple Music | `.aplmate(url)` | aplmate.com |
| <img src="https://cdn.simpleicons.org/bilibili/00AEEC" width="16" height="16" /> Bilibili.tv | `.snapwc(url)` | snapwc.com |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> Douyin | `.direct(url)` | direct page scrape |
| <img src="https://cdn.simpleicons.org/soundcloud/FF5500" width="16" height="16" /> SoundCloud | `.klickaud(url)` | klickaud.org |
| <img src="https://cdn.simpleicons.org/tiktok/000000" width="16" height="16" /> TikTok | `.snaptik(url)` | snaptik.app |
| | `.tiktokio(url)` | tiktokio.com |
| <img src="https://cdn.simpleicons.org/youtube/FF0000" width="16" height="16" /> YouTube | `.ytmp3(url)` | ytmp3.mobi |
| <img src="https://cdn.simpleicons.org/instagram/E4405F" width="16" height="16" /> Instagram | `.indown(url)` | indown.io |
| | `.downreels(url)` | downreels.com |
| <img src="https://cdn.simpleicons.org/bandcamp/1DA1F2" width="16" height="16" /> Bandcamp | `.bandcampdownloader(url, options)` | bandcampdownloader.app |

## Scraper Overview

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

## Issues & Requests

If you encounter any issues, broken scrapers, or request errors (which can happen frequently as source web pages update their endpoints), please open an issue.

You can also open an issue if you would like to request support for a new platform or scraper.

## License

MIT - (c) 2026 coflyn
