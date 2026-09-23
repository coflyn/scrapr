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
  const decipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(ct);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function scrape(url) {
  try {
    const { privateKey, publicKey } = generateClientKeyPair();
    const client = axios.create({
      baseURL: "https://snapwc.com",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://snapwc.com/id",
        Origin: "https://snapwc.com",
        "X-Forwarded-For": randomIp(),
      },
      timeout: 10000,
    });

    const initPayload = encryptRequest(
      {
        lang: "id",
        page: "https://snapwc.com/id",
        ref: "",
        user_agent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      publicKey,
    );

    const { data: initEncResp } = await client.post(
      "/api/session/init",
      initPayload,
    );
    const initData = decryptResponse(initEncResp, privateKey);
    const token = initData.data?.token;
    if (!token) throw new Error("Failed to get snapwc session token.");

    const parsePayload = encryptRequest(
      { url, token, lang: "id" },
      publicKey,
    );
    const { data: parseEncResp } = await client.post(
      "/api/ajax/parse",
      parsePayload,
    );
    const parseData = decryptResponse(parseEncResp, privateKey);

    const downloads = [];
    if (parseData.data?.medias) {
      parseData.data.medias.forEach((m) => {
        if (m.url) {
          downloads.push({
            quality: m.quality || m.resolution || "Normal",
            type: m.extension === "mp3" ? "audio" : "video",
            url: m.url,
          });
        }
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found from snapwc.");
    }

    return {
      status: true,
      result: {
        title: parseData.data?.title || "Bilibili Video",
        thumbnail: parseData.data?.thumbnail || "",
        type: "video",
        downloads,
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape };
