const { scrape: scrapeBilibili } = require("./lib/bilibili/snapwc");
const { scrape: scrapeDouyin } = require("./lib/douyin/direct");
const { scrape: scrapeApplemusic } = require("./lib/applemusic/aplmate");
const { scrape: scrapeSoundcloud } = require("./lib/soundcloud/klickaud");

module.exports = {
  scrapeBilibili,
  scrapeDouyin,
  scrapeApplemusic,
  scrapeSoundcloud,
};
