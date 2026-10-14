const sfile = require("./sfile");
const safelinku = require("./safelinku");
const mediafire = require("./mediafire");
const sub2unlock = require("./sub2unlock");
const rekonise = require("./rekonise");
const unshorten = require("./unshorten");
const pixeldrain = require("./pixeldrain");
const catbox = require("./catbox");
const krakenfiles = require("./krakenfiles");
const doodstream = require("./doodstream");
const gdrive = require("./gdrive");

module.exports = {
  sfile: sfile.scrape,
  safelinku: safelinku.scrape,
  mediafire: mediafire.scrape,
  sub2unlock: sub2unlock.scrape,
  rekonise: rekonise.scrape,
  unshorten: unshorten.scrape,
  pixeldrain: pixeldrain.scrape,
  catbox: catbox.scrape,
  krakenfiles: krakenfiles.scrape,
  doodstream: doodstream.scrape,
  gdrive: gdrive.scrape,
};
