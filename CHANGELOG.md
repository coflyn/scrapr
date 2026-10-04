# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-04

### Added

- `resolver.mediafire`: Direct MediaFire file resolver extracting filename, file size, and direct CDN download URL.
- `resolver.sfile`: Direct Sfile (`sfile.co` / `sfile.mobi`) file resolver with session handshake and CDN download stream extraction.
- `resolver.sub2unlock`: Sub2Unlock destination extractor parsing Next.js page state without requiring social media tasks, with default auto-resolving to direct file hosts.
- `resolver.rekonise`: Rekonise social unlock resolver with automated action handshake and destination extraction.
- `resolver.safelinku`: Gateway resolver for Safelinku, Semawur, and AdLinkFly networks (`sfl.gl`, `safelinku.com`, `semawur.com`, `app.khaddavi.net`) with default auto-resolving to direct file hosts.
- `resolver.unshorten`: Universal redirection resolver tracing HTTP 301/302 location chains with auto-resolving for destination file hosts.
- `resolver`: Added new module namespace in `scrapr` for file host resolving and link unwrapping.

## [1.1.1] - 2026-10-03

### Fixed

- `bandcamp.bandcampdownloader`: Fixed album and track extraction by adopting upstream CSRF token retrieval (`POST /get/token`) and multipart form payloads.
- `spotify.soundloaders`: Migrated to Spotimate active engine (`spotimate.app`) with `/api/userverify` handshake and multipart track resolution.
- `spotify.spotmate`: Migrated to Spotimate active engine with multipart payload resolution and multi-track support.
- `tiktok.tikdownloader`: Resolved Cloudflare 403 challenge using native HTTP/1.1 transport to extract directly from `tikdownloader.io` without fallback.
- `twitter.savetwt`: Fixed 422 validation failure by normalizing links to `x.com`, with redirect resolution and direct FxTwitter fallback.
- `twitter.tvd`: Updated video link parser and added direct FxTwitter fallback.
- `youtube.ytmp3`: Added query cache-busters, modern fetch headers, and redirect loop handling for progress polling.
- `threads.threadster`: Added URL normalization and JWT base64 payload decoding for direct stream extraction.

### Removed

- `instagram.downreels`: Removed scraper due to dead upstream host (`api.zoraahub.com`).

## [1.1.0] - 2026-09-27

### Added

- `spotify.spotisaver`: Added Spotify track, album, and playlist resolver powered by Spotisaver engine (`spotisaver.net`) with dynamic signature handshake, direct 320kbps MP3 stream, and `result.getAudioBuffer()` helper.

### Fixed

- `pinterest.pindown`: Fixed verification challenge solver implementing AES-256-CBC payload decryption and dynamic seed handshake from `pindown.io/js/script.js?v=1.2`.
- `youtube.playlist`: Added parser for YouTube's modern `lockupViewModel` and `pageHeaderRenderer` structure in `ytInitialData`.
- `instagram.snapsave`: Replaced legacy decoder with modern obfuscated script unpacker and direct media resolution.
- `instagram.snapinsta`: Added automated system Chrome/Chromium detection to Playwright launcher.
- `spotify.spotidown`: Fixed track resolution by porting Mori engine session handling and dummy token handshake, restoring direct 320kbps MP3 link extraction.
- `README.md`: Updated Spotify performance matrix with Spotisaver and fixed SpotiDown.

## [1.0.3] - 2026-09-26

### Added

- `terabox.sechno`: Added TeraBox cloud file & video resolver powered by Sechno engine with direct binary download link (`dlink`), fast m3u8 streaming, and file metadata extraction.
- `reddit.rapidsave`: Added Reddit video/media resolver powered by RapidSave with shortlink canonical resolution and separate audio track extraction.

### Fixed

- `instagram.indown`: Fixed upstream 403 challenge by porting Mori engine's `indown.net` JSON API, restoring high-speed media extraction without Cloudflare blocks.
- `README.md`: Promoted Instagram Indown back to High reliability.

## [1.0.2] - 2026-09-25

### Fixed

- `rednote.direct`: Turns out the scraper was never actually broken, we were just testing an expired link the whole time (total skill issue on our end lol). Confirmed 100% alive and working.
- `douyin.direct`: Fixed video extraction by porting Mori engine's shortlink resolver, `ttwid` cookie handshake, and 400ms retry so ByteDance stops rage-blocking SSR hydration.
- `README.md`: Promoted Douyin and RedNote back to High reliability where they belong.

## [1.0.1] - 2026-09-25

### Fixed

- `soundcloud.klickaud`: Fixed 403 Forbidden via dynamic CSRF token extraction and SSE capability grant authorization.
- `pixiv.ajax`: Fixed 403 Forbidden on direct artwork queries via official oEmbed endpoint and `pixiv.re` proxy fallback.

### Removed

- `bilibili.snapwc`: Removed dead scraper due to upstream SnapWC architecture migration to SPA.

### Deprecated / Status Updates

- `douyin.direct`: Marked broken (blocked by ByteDance ACrawler JS challenge).
- `rednote.direct`: Marked broken (blocked by Xiaohongshu anti-bot redirect 302).
- `tiktok.tikdownloader`: Marked broken (Cloudflare 403 challenge on tikdownloader.io).
- `bandcamp.bandcampdownloader`, `instagram.indown`: Marked degraded (Cloudflare 403 on upstream sites).
- `README.md`: Updated performance & reliability matrix across all platforms.

## [1.0.0] - 2026-09-25

### Added

- Initial public release on npm as `@coflyn/scrapr`.
- Support for 15 multimedia platforms:
  - **Video**: TikTok, Instagram, YouTube, Douyin, Bilibili, Facebook, Twitter / X, Threads, RedNote.
  - **Audio & Music**: Spotify, SoundCloud, Apple Music, Bandcamp.
  - **Images & Art**: Pinterest, Pixiv.
- Standardized response schema across all scrapers (`status`, `result` with `title`, `thumbnail`, `downloads`).
- Specialized collection schema for albums and playlists (YouTube playlist, Bandcamp album).
- Lightweight HTTP parsers using `axios` and `cheerio` by default.
- Optional browser automation fallback support (`puppeteer-core`, `playwright-extra`) for protected endpoints.
- CommonJS and ESM module compatibility.
- Comprehensive test suite covering all platform methods.
