const axios = require("axios");
const cheerio = require("cheerio");

async function scrape(url) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://spotidown.app/",
      Origin: "https://spotidown.app",
    };

    const r1 = await axios.get("https://spotidown.app/", {
      headers: { ...headers, Accept: "text/html" },
    });
    const mainPage = r1.data;
    const cookies = r1.headers["set-cookie"];

    const $1 = cheerio.load(mainPage);
    const $form = $1('form[name="spotifyurl"]');

    if (!$form.length) {
      throw new Error("Could not find the submission form on Spotidown.");
    }

    const fd1 = new URLSearchParams();
    $form.find("input").each((i, el) => {
      const name = $1(el).attr("name");
      const value = $1(el).attr("value") || "";
      if (name && name !== "url") {
        fd1.append(name, value);
      }
    });

    fd1.append("url", url);
    fd1.append("g-recaptcha-response", ""); 

    const r2 = await axios.post(
      "https://spotidown.app/action",
      fd1.toString(),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookies ? cookies.map((c) => c.split(";")[0]).join("; ") : "",
        },
      },
    );

    if (r2.data.error) {
      throw new Error(r2.data.message || "Error during initial action.");
    }

    const $2 = cheerio.load(r2.data.data);
    const $form2 = $2('form[name="submitspurl"]');

    if ($form2.length) {
      const fd2 = new URLSearchParams();
      $form2.find("input").each((i, el) => {
        const name = $2(el).attr("name");
        const value = $2(el).attr("value") || "";
        if (name) fd2.append(name, value);
      });

      const r3 = await axios.post(
        "https://spotidown.app/action/track",
        fd2.toString(),
        {
          headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookies
              ? cookies.map((c) => c.split(";")[0]).join("; ")
              : "",
          },
        },
      );

      if (r3.data.error) {
        throw new Error(r3.data.message || "Error during track action.");
      }

      return parseDownloadPage(r3.data.data);
    } else {
      return parseDownloadPage(r2.data.data);
    }
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

function parseDownloadPage(html) {
  const $ = cheerio.load(html);

  const title =
    $("h3").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Spotify Track";
  const artist = $("p").first().text().trim();
  const thumbnail = $("img").first().attr("src");

  const downloads = [];
  $("a").each((i, el) => {
    const $el = $(el);
    const link = $el.attr("href");
    const text = $el.text().trim();

    if (
      link &&
      link.startsWith("http") &&
      !link.includes("premium.html") &&
      text !== "Download Another Song"
    ) {
      downloads.push({
        type: text || "Download",
        url: link,
      });
    }
  });

  return {
    status: true,
    result: {
      title: artist ? `${artist} - ${title}` : title,
      thumbnail,
      type: "audio",
      downloads,
    },
  };
}

module.exports = { scrape };
