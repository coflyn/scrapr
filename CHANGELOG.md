# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
