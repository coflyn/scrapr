# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
