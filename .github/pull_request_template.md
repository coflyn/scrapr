## Summary

Describe changes proposed in this Pull Request.

- Platform affected:
- Scraper method:
- Type of change: [ ] New scraper  [ ] Bug fix  [ ] Refactor  [ ] Documentation

## Verification

Provide test commands and verify that output follows standardized schema:

```bash
node -e "const scrapr = require('./index'); scrapr.<platform>.<method>('<sample-url>').then(console.log);"
```

Sample JSON response:
```json
{
  "status": true,
  "result": { ... }
}
```

## Checklist

- [ ] Code follows existing project structure (`lib/<platform>/<method>/index.js`).
- [ ] Exported in platform `index.js` and root `index.js`.
- [ ] Output matches response schema with status, title, thumbnail, type, and downloads.
- [ ] No unneeded heavy dependencies added (prefer Axios + Cheerio over Puppeteer/Playwright).
- [ ] Tested with working live URLs.
