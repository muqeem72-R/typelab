/* Local dev server: `npm run serve` (or `node tools/serve.js`), then open http://127.0.0.1:5173/
   - Serves the app with the same headers as production (it reads them from _headers), so an
     inline script or style fails here first.
   - Serves /api/* with the real API code (server/core.mjs). The data lives in .devdata/ (ignored
     by git): db.json for the leaderboard and secrets.json for the hashing and signing keys,
     which are made on first run.
   - Login codes are not emailed here: the "email" is printed in this console and saved in
     .devdata/outbox.json (unless MAIL_PROVIDER, MAIL_API_KEY and MAIL_FROM are set).
   index.html also works opened straight from disk, but then there is no API (no rank, no
   verified certificates). The server binds to 127.0.0.1 only. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 5173;
const dataDir = path.join(root, ".devdata");
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

// The headers that production sends for every path, taken from the _headers file.
function siteHeaders() {
  const out = {};
  let inAll = false;
  for (const line of fs.readFileSync(path.join(root, "_headers"), "utf8").split(/\r?\n/)) {
    if (/^\S/.test(line)) inAll = line.trim() === "/*";
    else if (inAll && line.includes(":")) {
      const i = line.indexOf(":");
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return out;
}

function devStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "db.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return {}; } };
  return {
    get: async (k) => read()[k] ?? null,
    put: async (k, v) => { const db = read(); db[k] = v; fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(db)); },
  };
}

function devSecrets() {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "secrets.json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { /* first run */ }
  const secrets = { salt: crypto.randomBytes(24).toString("hex"), signKey: crypto.randomBytes(24).toString("hex") };
  fs.writeFileSync(file, JSON.stringify(secrets));
  return secrets;
}

// Stands in for a real email service while developing: the message is written to .devdata/outbox.json
// and printed here, and `GET /dev/outbox?to=you@example.com` returns the last one. Set MAIL_PROVIDER,
// MAIL_API_KEY and MAIL_FROM in the environment to send real email from the dev server instead.
function devMailer() {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "outbox.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return []; } };
  const send = async (msg) => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify([...read(), { ...msg, at: Date.now() }].slice(-50)));
    console.log(`[dev mail] to ${msg.to}: ${msg.subject}`);
  };
  send.outbox = read;
  return send;
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > limit) { reject(new Error("too-large")); req.destroy(); }
    });
    req.on("end", () => resolve(text));
    req.on("error", reject);
  });
}

async function main() {
  const core = await import(pathToFileURL(path.join(root, "server", "core.mjs")).href);
  const { createMailer } = await import(pathToFileURL(path.join(root, "server", "mail.mjs")).href);
  const store = devStore();
  const secrets = devSecrets();
  const headers = siteHeaders();
  const realMail = createMailer(process.env);
  const mail = realMail || devMailer();

  const sendJson = (res, status, body) => {
    res.writeHead(status, { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };

  http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    // Development only, and only while the fake mailer is in use: read the "email" that was sent.
    if (url.pathname === "/dev/outbox" && !realMail) {
      const to = (url.searchParams.get("to") || "").toLowerCase();
      const last = mail.outbox().filter((m) => m.to.toLowerCase() === to).pop();
      return sendJson(res, last ? 200 : 404, last || { error: "nothing sent to that address" });
    }

    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, { error: "method-not-allowed" });
      let body = null;
      if (req.method === "POST") {
        try {
          const text = await readBody(req);
          body = text ? JSON.parse(text) : null;
        } catch (e) { return sendJson(res, e.message === "too-large" ? 413 : 400, { error: e.message === "too-large" ? "too-large" : "bad-json" }); }
      }
      const route = url.pathname.slice(5).split("/").filter(Boolean);
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || null;
      const out = await core.handle(
        { method: req.method, route, query: url.searchParams, body, token },
        { store, secrets, mail, ip: req.socket.remoteAddress });
      return sendJson(res, out.status, out.body);
    }

    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
    const blocked = file.startsWith(dataDir) || file.includes(path.sep + ".git" + path.sep) || path.basename(file).startsWith(".");
    if ((!file.startsWith(root + path.sep) && file !== root) || blocked) { res.writeHead(403).end("Forbidden"); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); return; }
      res.writeHead(200, { ...headers, "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  }).listen(port, "127.0.0.1", () => console.log(`TypeLab: http://127.0.0.1:${port}/  (API data in .devdata/)`));
}

main().catch((e) => { console.error(e); process.exit(1); });
