# Contributing to scrapr

Thank you for your interest in contributing to scrapr. This project provides lightweight Node.js scrapers for resolving multimedia links.

## Principles

1. **HTTP first**: Always prefer Axios and Cheerio. Avoid headless browsers (Puppeteer, Playwright) unless Cloudflare challenges or bot protections make raw HTTP impossible.
2. **Standardized schema**: Every scraper method must return the unified JSON response shape.
3. **Fallback redundancy**: Add alternative scrapers rather than replacing existing working scrapers. Keep multiple methods per platform where possible.
4. **No invented facts or metrics**: Document actual working behavior, rate limits, and known caveats.

---

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/scrapr.git
   cd scrapr
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

---

## Project Structure

```text
scrapr/
├── index.js                  # Main export exposing all platform modules
├── lib/
│   ├── <platform>/           # Platform namespace (e.g., tiktok, youtube)
│   │   ├── index.js          # Platform aggregator
│   │   └── <method>/         # Specific scraper implementation
│   │       └── index.js
```

---

## Adding or Fixing a Scraper

### 1. Implement Scraper Function

Place your implementation inside `lib/<platform>/<method>/index.js`:

```javascript
const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  if (!url) {
    throw new Error("URL is required");
  }

  // Implementation logic here
  return {
    status: true,
    result: {
      title: "Extracted media title",
      thumbnail: "https://example.com/thumb.jpg",
      type: "video", // "video", "audio", "image", or "mixed"
      downloads: [
        {
          quality: "1080p",
          format: "mp4",
          url: "https://example.com/video.mp4"
        }
      ]
    }
  };
}

module.exports = { scrape };
```

### 2. Export the Scraper

1. Export the new method in `lib/<platform>/index.js`:
   ```javascript
   const mymethod = require("./mymethod").scrape;

   module.exports = {
     mymethod,
   };
   ```
2. Ensure the platform is exported in the root `index.js`.

### 3. Response Schema Contract

Every scraper output must conform to this structure:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `boolean` | `true` on success, `false` on expected parse failure |
| `result.title` | `string` | Title or caption of the media |
| `result.thumbnail` | `string` | Direct link to media preview image |
| `result.type` | `string` | Media classification: `video`, `audio`, `image`, or `mixed` |
| `result.downloads` | `array` | List of available downloadable files |
| `result.downloads[].quality` | `string` | Stream resolution or bitrate label |
| `result.downloads[].format` | `string` | Extension or codec (`mp4`, `mp3`, `jpg`) |
| `result.downloads[].url` | `string` | Direct link to media download |

---

## Verification & Testing

### 1. Automated Tests

Register a valid sample URL in `test/test.js` under `SAMPLES`:

```javascript
<platform>: {
  url: "https://...",
  methods: ["<method>"],
}
```

Run the test suite:

```bash
npm test
```

### 2. Quick One-Line Test

Test your scraper directly against a live URL:

```bash
node -e "const scrapr = require('./index'); scrapr.<platform>.<method>('<valid-test-url>').then(console.log).catch(console.error);"
```

Verify that:
- The command resolves with HTTP 200 URLs.
- The returned payload adheres strictly to the response schema.
- Invalid or dead URLs return `{ status: false, message: ... }` instead of unhandled rejections.

---

## Submitting Changes

1. Create a descriptive branch:
   ```bash
   git checkout -b feat/add-threads-resolver
   ```
2. Commit your work using conventional commit messages:
   - `feat: add new threadster method for threads`
   - `fix: update selectors for tiktok savetik scraper`
   - `docs: update readme with new response format`
3. Push your branch to GitHub:
   ```bash
   git push origin feat/add-threads-resolver
   ```
4. Open a Pull Request against the `main` branch. Provide test URLs and output logs in the PR description.
