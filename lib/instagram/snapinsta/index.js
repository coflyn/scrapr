let chromium, stealth;
try {
  chromium = require("playwright-extra").chromium;
  stealth = require("puppeteer-extra-plugin-stealth")();
  chromium.use(stealth);
} catch (e) {
  // Optional — requires playwright-extra + puppeteer-extra-plugin-stealth
}

const cheerio = require("cheerio");

async function scrape(url) {
  if (!chromium) {
    return {
      status: false,
      message:
        "playwright-extra is not installed. Install it with: npm install playwright-extra puppeteer-extra-plugin-stealth",
    };
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    const page = await context.newPage();

    await page.goto("https://snapinsta.to/", {
      waitUntil: "load",
      timeout: 60000,
    });

    await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

    await page.waitForSelector("#s_input", { timeout: 30000 });
    await page.fill("#s_input", url);

    await page.waitForTimeout(500);

    const submitBtn = "button.btn-default";
    await page.waitForSelector(submitBtn);
    await page.click(submitBtn);

    let success = false;
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      const modalClose = await page.$("#closeModalBtn");
      if (modalClose && (await modalClose.isVisible())) {
        await modalClose.click();
      }

      const downloadBtn = await page.$("a.btn-premium");
      if (downloadBtn && (await downloadBtn.isVisible())) {
        success = true;
        break;
      }

      const errorAlert = await page.$(".alert-danger");
      if (errorAlert && (await errorAlert.isVisible())) {
        const msg = await errorAlert.innerText();
        throw new Error(msg);
      }

      await page.waitForTimeout(1000);
    }

    if (!success) {
      throw new Error(
        "Timeout waiting for results. Cloudflare Turnstile might not have been solved correctly.",
      );
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    const downloads = [];
    $("a.btn-premium").each((i, el) => {
      const $el = $(el);
      let link = $el.attr("href");
      const text = $el.text().trim();

      if (link) {
        if (link.startsWith("/")) {
          link = "https://snapinsta.to" + link;
        }

        downloads.push({
          url: link,
          type: text.toLowerCase().includes("video") ? "video" : "image",
          text: text,
        });
      }
    });

    $("img").each((i, el) => {
      const src = $(el).attr("src");
      if (
        src &&
        (src.includes("cdn") || src.includes("instagram")) &&
        downloads[i]
      ) {
        downloads[i].thumbnail = src;
      }
    });

    const title = $("h3").first().text().trim() || "Instagram Content";

    await browser.close();

    return {
      status: true,
      result: {
        title,
        downloads,
      },
    };
  } catch (error) {
    if (browser) await browser.close();
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
