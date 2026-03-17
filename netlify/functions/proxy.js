const https = require("https");
const zlib = require("zlib");

const API_BASE = "https://api.artist.tools";

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "x-api-key, Content-Type, Accept",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  // Build the target URL
  // event.path = /.netlify/functions/proxy/playlists/search
  const apiPath = event.path.replace("/.netlify/functions/proxy", "") || "";
  const qs = event.rawQuery ? "?" + event.rawQuery : "";
  const url = `${API_BASE}/v2${apiPath}${qs}`;

  const apiKey = (event.headers && (event.headers["x-api-key"] || event.headers["X-Api-Key"])) || "";

  console.log(`Proxying: ${url}`);

  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://app.artist.tools",
          "Referer": "https://app.artist.tools/",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const enc = res.headers["content-encoding"] || "";

          const decompress = (buf, cb) => {
            if (enc === "gzip") zlib.gunzip(buf, cb);
            else if (enc === "deflate") zlib.inflate(buf, cb);
            else cb(null, buf);
          };

          decompress(raw, (err, body) => {
            resolve({
              statusCode: res.statusCode,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "x-api-key, Content-Type, Accept",
              },
              body: (err ? raw : body).toString("utf-8"),
            });
          });
        });
      }
    );

    req.on("error", (e) => {
      console.error("Request error:", e.message);
      resolve({
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: e.message }),
      });
    });

    req.setTimeout(45000, () => {
      req.destroy();
      resolve({
        statusCode: 504,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Gateway timeout" }),
      });
    });
  });
};
