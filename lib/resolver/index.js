const sfile = require("./sfile");
const safelinku = require("./safelinku");
const mediafire = require("./mediafire");
const sub2unlock = require("./sub2unlock");
const rekonise = require("./rekonise");
const unshorten = require("./unshorten");

module.exports = {
  sfile: sfile.scrape,
  safelinku: safelinku.scrape,
  mediafire: mediafire.scrape,
  sub2unlock: sub2unlock.scrape,
  rekonise: rekonise.scrape,
  unshorten: unshorten.scrape,
};
