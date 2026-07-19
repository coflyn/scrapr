let puppeteer;
try {
  puppeteer = require("puppeteer-core");
} catch (e) {
  // Optional — requires puppeteer-core installed separately
}

const fs = require("fs");
const os = require("os");

function findChromePath() {
  const platform = os.platform();
  if (platform === "darwin") {
    const p = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (fs.existsSync(p)) return p;
  } else if (platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    const paths = ["/usr/bin/google-chrome", "/usr/bin/chrome"];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function scrape(url) {
  if (!puppeteer) {
    return {
      status: false,
      message:
        "puppeteer-core is not installed. Install it with: npm install puppeteer-core",
    };
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    return {
      status: false,
      message:
        "Google Chrome was not found on your system. Please install Google Chrome to run this scraper.",
    };
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );

    await page.goto("https://savetik.co/id/douyin-downloader", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector("input#s_input", { timeout: 15000 });
    await page.type("input#s_input", url);
    await page.click("button.btn-red");
    await page.waitForSelector(
      'a.btn-premium, a.btn-red, a[href*="snapcdn.app"]',
      {
        timeout: 30000,
      },
    );

    const results = await page.evaluate(() => {
      const titleEl = document.querySelector(".tik-video h3, .video-title");
      const title = titleEl ? titleEl.innerText.trim() : "TikTok Video";

      const downloads = [];
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        const href = a.getAttribute("href");
        const text = a.innerText.trim();
        if (
          href &&
          (href.includes("snapcdn.app") ||
            href.includes("/download") ||
            a.className.includes("download") ||
            a.className.includes("btn-premium"))
        ) {
          let type = "video";
          let label = text;

          if (
            text.toLowerCase().includes("audio") ||
            text.toLowerCase().includes("mp3")
          ) {
            type = "audio";
          } else if (text.toLowerCase().includes("hd")) {
            label = "MP4 HD";
          } else {
            label = "MP4 (No Watermark)";
          }

          if (!downloads.some((d) => d.url === href)) {
            downloads.push({ label, type, url: href });
          }
        }
      }
      return { title, downloads };
    });

    if (!results.downloads || results.downloads.length === 0) {
      throw new Error("Could not extract any download links from the page.");
    }

    return {
      status: true,
      result: results,
    };
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { scrape };
