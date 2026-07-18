# scrapr

Lightweight Node.js library for resolving multimedia links through third-party scraping services. Decoupled from CLI interfaces, built for easy integration into backend services, bots, and other applications.

## Usage

```js
const { scrapeApplemusic, scrapeBilibili, scrapeDouyin, scrapeSoundcloud } = require("scrapr");

const res = await scrapeApplemusic("https://music.apple.com/us/song/...");
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

| Function | Platform | Source |
|----------|----------|--------|
| `scrapeApplemusic(url)` | Apple Music | aplmate.com |
| `scrapeBilibili(url)` | Bilibili.tv | snapwc.com |
| `scrapeDouyin(url)` | Douyin | direct page scrape |
| `scrapeSoundcloud(url)` | SoundCloud | klickaud.org |

## Scraper Overview

### Apple Music (`aplmate.com`)

Fast response (~3-5s). Relies on form submission with Turnstile bypass. Returns MP3 download URLs. Sometimes produces duplicate links or noise ("Download Another Song").

### Bilibili (`snapwc.com`)

Most complex scraper. Uses RSA key exchange + AES encryption for API communication. Requires multi-step session init and event logging. Returns muxed MP4 video with subtitles. Slower (~10-15s). Fails entirely if snapwc is down.

### Douyin (`direct`)

Pure page scrape without third-party service. Extracts video data from `window._ROUTER_DATA` using custom brace-balancing JSON parser. Returns both no-watermark and watermark variants. Fast (~3-5s). Most fragile — Douyin frequently changes page structure.

### SoundCloud (`klickaud.org`)

Worker-based scraping via SSE stream. Requires priming POST then waiting for worker completion. Slowest (~20-60s). Returns 128kbps MP3 only. No thumbnail or metadata. Worker may randomly fail on certain tracks.

## License

MIT - (c) 2026 coflyn
