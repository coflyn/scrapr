const crypto = require("crypto");
const axios = require("axios");

const SERVER_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvDU+dR2bSews55172x4L
s/ja+Dxt9ViZcj/nY0YodYo7l4jEKtEiCNV28lpFj3CkP4HKRCjL/jYkQNKGPwVg
gUCGr/jBF1FpDLsqa0kg+dtfkm5Xm9QAyMBeG/jPdl5BEPOVh33A1UkPO/Xw6kSH
rfghOUwBMzRBtXeYuJiYs5sKrf+Wy5sv708TI6G4hAPJG/69W4NNFJi/ipBNxntG
dAoUHpEy4iYsvBgiccE7U0MBDnSHSqBBtIdMMFRHARn/tc+jXaadS0a4YmhTygiN
eAJU4QuqAE25CsvkzIYIVEmlRXVcC0afw76XcwDpKBMVR5bEPzd3tMEfA+R34L1D
fQIDAQAB
-----END PUBLIC KEY-----`;

function randomIp() {
  return `${Math.floor(Math.random() * 220) + 10}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
}

function generateClientKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 1024,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { privateKey, publicKey };
}

function encryptRequest(payload, clientPublicKey) {
  const t = crypto.randomBytes(16).toString("hex");
  const key = crypto.createHash("sha256").update(t).digest();
  const iv = crypto.randomBytes(16);
  const plaintext = JSON.stringify(payload);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encrypted_data = Buffer.concat([iv, encrypted]).toString("base64");
  const encryptedKeyBuf = crypto.publicEncrypt(
    { key: SERVER_PUBLIC_PEM, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(t, "utf8"),
  );
  return {
    encrypted_key: encryptedKeyBuf.toString("base64"),
    encrypted_data,
    client_public_key: clientPublicKey,
  };
}

function decryptResponse(resp, clientPrivateKey) {
  const decryptedKeyBuf = crypto.privateDecrypt(
    { key: clientPrivateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(resp.encrypted_key, "base64"),
  );
  const t = decryptedKeyBuf.toString("utf8");
  const key = crypto.createHash("sha256").update(t).digest();
  const raw = Buffer.from(resp.encrypted_data, "base64");
  const iv = raw.subarray(0, 16);
  const ct = raw.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(ct);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function scrape(url) {
  const ip = randomIp();
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "x-forwarded-for": ip,
    "client-ip": ip,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };

  const pageRes = await axios.get("https://snapwc.com/bilibili", { headers });
  const setCookie = pageRes.headers["set-cookie"];
  const cookieList = [];
  if (setCookie) cookieList.push(...setCookie.map(c => c.split(";")[0]));
  let cookieStr = cookieList.join("; ");
  headers.cookie = cookieStr;
  headers.accept = "*/*";
  headers["content-type"] = "application/json";
  headers.origin = "https://snapwc.com";
  headers.referer = "https://snapwc.com/bilibili";
  headers["x-locale"] = "en-US";

  const initRes = await axios.post("https://api.snapwc.com/api.visitor/init", {}, { headers });
  const visitorSetCookie = initRes.headers["set-cookie"];
  if (visitorSetCookie) {
    visitorSetCookie.forEach(c => {
      const parts = c.split(";")[0];
      const name = parts.split("=")[0];
      const idx = cookieList.findIndex(item => item.startsWith(name + "="));
      if (idx !== -1) cookieList.splice(idx, 1);
      cookieList.push(parts);
    });
    headers.cookie = cookieList.join("; ");
  }

  const pageSessionId = crypto.randomUUID();
  const clientTimestamp = new Date().toISOString();
  const baseEventData = { page_session_id: pageSessionId, client_timestamp: clientTimestamp, page_path: "/bilibili", page_search: "", page_hash: "", referrer_host: "", has_visitor_id: true };

  await axios.post("https://api.snapwc.com/api.event/log", { name: "frontend_visitor_init_reused", data: baseEventData, channel: "frontend_debug" }, { headers });

  const parsedUrl = new URL(url);
  await axios.post("https://api.snapwc.com/api.event/log", { name: "frontend_parse_submit_started", data: { ...baseEventData, platform: "homepage", url_present: true, url_host: parsedUrl.hostname || "", url_protocol: parsedUrl.protocol || "", url_pathname: parsedUrl.pathname || "" }, channel: "frontend_debug" }, { headers });

  const captchaRes = await axios.post("https://api.snapwc.com/api.captcha/is_required", { scenario: "parser", data: { url } }, { headers });
  if (captchaRes.data?.status === true) throw new Error("SnapWC captcha required");

  const { privateKey, publicKey } = generateClientKeyPair();
  const reqBody = encryptRequest({ url }, publicKey);
  const parseRes = await axios.post("https://api.snapwc.com/api.parser/parse", reqBody, { headers });
  const decrypted = decryptResponse(parseRes.data, privateKey);
  return { status: true, result: decrypted };
}

module.exports = { scrape };
