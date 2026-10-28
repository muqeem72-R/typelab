/* TypeLab server logic: email login codes, session tokens, score sync, leaderboard, removal, and
   certificate signing. Pure request -> response logic with no framework in it. The same file runs in
   Cloudflare Worker (worker/index.js, storage = a KV namespace) and in the local
   dev server (tools/serve.js, storage = a JSON file).

   LOGIN. The email is proved with a one-time code: POST otp/send emails a 6-digit code, POST
   otp/verify checks it and returns a signed session token. Every route that changes anything needs
   that token (Authorization: Bearer <token>), so nobody can submit scores, delete an entry or ask
   for a certificate in someone else's name without being able to read their mail.

   WHAT IS STORED. For each player: a display name ("Mukeem K."), a few scores and counters, how long
   they have been on the site and how long they have really typed (totals, plus minutes for the last 14
   days), and a salted hash as the id. While a code is pending, a salted hash of the code. The email
   address is never stored and never returned. Scores and times are reported by the browser, so they are
   for fun: the server only rejects impossible values.

   OWNER VIEW. GET admin/players returns every player with those numbers. It needs the owner's own key
   (secret TYPELAB_ADMIN_KEY) in the Authorization header; with no such secret the route is off, and
   wrong keys are limited per visitor address. */

export const LIMITS = { maxWpm: 250, maxPlayers: 10000, minSyncGapMs: 1500, maxCodeLength: 2000 };
export const TIER_LESSONS = { core: 18, programmer: 24 };
export const OTP = { ttlMs: 10 * 60 * 1000, maxTries: 5, resendGapMs: 30 * 1000, maxPerHour: 5, ipPerHour: 20 };
export const TOKEN = { lifeMs: 90 * 86400000, refreshMs: 30 * 86400000 };

import { otpMessage } from "./mail.mjs";

const NAME_RE = /^[\p{L}\p{N} ._'-]{2,24}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const ID_RE = /^[a-f0-9]{24}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const HOUR = 3600 * 1000;
const ADMIN_TRIES_PER_HOUR = 10;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (text) => hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const round1 = (v) => Math.round(v * 10) / 10;

async function hmac(key, text) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(text)));
}

// Compares every character, so the time taken does not reveal how much of a secret was right.
function sameText(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const cleanName = (s) => String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();
export const validName = (s) => NAME_RE.test(cleanName(s));

// "Mukeem Khan" -> "Mukeem K." so a full name is never published; one-word names stay as they are.
export function displayName(name) {
  const parts = cleanName(name).split(" ");
  if (parts.length === 1) return parts[0];
  return parts[0] + " " + [...parts[parts.length - 1]][0].toUpperCase() + ".";
}

// ISO week in UTC, e.g. "2026-W44". The browser has the same function, and a test keeps them equal.
export function weekId(ms) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const playerId = async (email, salt) => (await sha(`${salt}:${String(email).toLowerCase().trim()}`)).slice(0, 24);

const reply = (status, body) => ({ status, body });
const fail = (error, status = 400, extra = {}) => reply(status, { error, ...extra });
const parse = (text) => { try { return text ? JSON.parse(text) : null; } catch (e) { return null; } };

async function loadBoard(store) {
  const board = parse(await store.get("board"));
  return board && board.players ? board : { v: 1, players: {} };
}

// Visible players, best first. `scope` is "all" (the overall score) or "week" (this week's best).
function ranking(board, scope, wk) {
  const rows = [];
  for (const [id, p] of Object.entries(board.players)) {
    if (p.h) continue;
    const score = scope === "week" ? (p.w === wk ? p.ws : 0) : p.s;
    if (score > 0) rows.push({ id, p, score });
  }
  rows.sort((a, b) => b.score - a.score || a.p.u - b.p.u || (a.id < b.id ? -1 : 1));
  return rows;
}

const rowView = (r, i, me) => ({ rank: i + 1, name: r.p.n, score: r.score, acc: r.p.a, sessions: r.p.q, you: r.id === me });

function meInfo(rows, id) {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  return { rank: i + 1, total: rows.length, score: rows[i].score, percent: Math.max(1, Math.ceil(((i + 1) / rows.length) * 100)) };
}

function checkStats(s, now) {
  if (!s || typeof s !== "object") return null;
  const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  const out = {
    score: num(s.score, 0, LIMITS.maxWpm), best: num(s.best, 0, LIMITS.maxWpm), acc: num(s.acc, 0, 100),
    sessions: num(s.sessions, 0, 1e6), lessons: num(s.lessons, 0, 24), wk: num(s.wk == null ? 0 : s.wk, 0, LIMITS.maxWpm),
  };
  if (Object.values(out).some((v) => v === null)) return null;
  if (out.score > out.best + 0.5) return null;
  out.week = weekId(now);
  if (s.wkId !== out.week || !WEEK_RE.test(s.wkId)) out.wk = 0;   // a weekly score from another week does not count
  return out;
}

// The usage numbers a player's browser reports: time on the site and real typing time, in milliseconds, plus a
// few counts and the last 14 days as [day number, minutes typed, minutes on the site]. A report that does not
// look right is ignored (the player's scores are still taken), never rejected.
function checkActivity(a) {
  if (!a || typeof a !== "object") return null;
  const whole = (v, hi) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= hi ? Math.round(v) : null);
  const out = {
    si: whole(a.site, 1e11), ty: whole(a.typed, 1e11), st: whole(a.streak, 40000), sd: whole(a.streakDays, 40000), ad: whole(a.activeDays, 40000),
    f: a.first == null ? 0 : whole(a.first, 60000),
  };
  if (Object.values(out).some((v) => v === null)) return null;
  if (!Array.isArray(a.days) || a.days.length > 14) return null;
  out.d = [];
  for (const row of a.days) {
    if (!Array.isArray(row) || row.length !== 3) return null;
    const d = whole(row[0], 60000);
    const t = whole(row[1], 1440);
    const s = whole(row[2], 1440);
    if (d === null || t === null || s === null || d < 15000) return null;
    out.d.push([d, t, s]);
  }
  return out;
}

// ---- session tokens ----------------------------------------------------------------------------

const signPayload = async (payloadB64, key) => b64url(await hmac(key, payloadB64)).slice(0, 22);

// A token is  t1.<payload>.<signature>  where the payload is { i: player id, e: expiry time }.
// Nothing is stored on the server, so it cannot be revoked one by one; changing TYPELAB_SIGN_KEY revokes all.
async function makeToken(id, { secrets, now }) {
  const exp = now + TOKEN.lifeMs;
  const p = b64url(enc.encode(JSON.stringify({ i: id, e: exp })));
  return { token: `t1.${p}.${await signPayload("session:" + p, secrets.signKey)}`, exp };
}

async function readToken(token, { secrets, now }) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "t1") return { error: "bad-token" };
  if (!sameText(await signPayload("session:" + parts[1], secrets.signKey), parts[2])) return { error: "bad-token" };
  try {
    const { i, e } = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (!ID_RE.test(i) || !Number.isFinite(e)) return { error: "bad-token" };
    return e < now ? { error: "expired" } : { id: i, exp: e };
  } catch (err) {
    return { error: "bad-token" };
  }
}

async function authenticate(req, ctx) {
  const a = await readToken(req.token, ctx);
  return a.id ? a : null;
}

const unauthorized = async (req, ctx) => {
  const a = await readToken(req.token, ctx);
  return fail(a.error || "bad-token", 401);
};

// ---- email login codes ---------------------------------------------------------------------------

function randomCode() {
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= 4294000000);   // a multiple of a million, so every code is equally likely
  return String(a[0] % 1000000).padStart(6, "0");
}

const codeHash = (id, code, salt) => sha(`${salt}:otp:${id}:${code}`);

async function otpSend(req, { store, secrets, now, ip, mail }) {
  const email = String((req.body && req.body.email) || "").trim();
  if (!EMAIL_RE.test(email)) return fail("bad-email");
  if (!mail) return fail("mail-not-configured", 503);

  // Limit per visitor address, so one person cannot use TypeLab to flood many inboxes.
  let ipKey = null;
  let ipSent = [];
  if (ip) {
    ipKey = "ip:" + (await sha(`${secrets.salt}:ip:${ip}`)).slice(0, 16);
    ipSent = (parse(await store.get(ipKey)) || []).filter((t) => now - t < HOUR);
    if (ipSent.length >= OTP.ipPerHour) return fail("too-many", 429, { retryAfter: Math.ceil((HOUR - (now - ipSent[0])) / 1000) });
  }

  // Limit per email address, so one inbox is not flooded either.
  const id = await playerId(email, secrets.salt);
  const key = "otp:" + id;
  const prev = parse(await store.get(key)) || {};
  const sent = (prev.sent || []).filter((t) => now - t < HOUR);
  if (sent.length && now - sent[sent.length - 1] < OTP.resendGapMs) {
    return fail("wait", 429, { retryAfter: Math.ceil((OTP.resendGapMs - (now - sent[sent.length - 1])) / 1000) });
  }
  if (sent.length >= OTP.maxPerHour) return fail("too-many", 429, { retryAfter: Math.ceil((HOUR - (now - sent[0])) / 1000) });

  const code = randomCode();
  await store.put(key, JSON.stringify({ h: await codeHash(id, code, secrets.salt), exp: now + OTP.ttlMs, tries: 0, sent: [...sent, now] }), 7200);
  if (ipKey) await store.put(ipKey, JSON.stringify([...ipSent, now]), 3700);

  try {
    await mail({ to: email, ...otpMessage(code, OTP.ttlMs / 60000) });
  } catch (e) {
    return fail("mail-failed", 502);   // the attempt still counts towards the limits above
  }
  return reply(200, { ok: true, expiresIn: OTP.ttlMs / 1000, resendIn: OTP.resendGapMs / 1000 });
}

async function otpVerify(req, ctx) {
  const { store, secrets, now } = ctx;
  const email = String((req.body && req.body.email) || "").trim();
  const code = String((req.body && req.body.code) || "").trim();
  if (!EMAIL_RE.test(email)) return fail("bad-email");
  if (!/^\d{6}$/.test(code)) return fail("bad-code");

  const id = await playerId(email, secrets.salt);
  const key = "otp:" + id;
  const rec = parse(await store.get(key));
  if (!rec || !rec.h || now > rec.exp) return fail("code-expired");
  if (rec.tries >= OTP.maxTries) return fail("too-many-tries", 429);

  if (!sameText(rec.h, await codeHash(id, code, secrets.salt))) {
    rec.tries++;
    await store.put(key, JSON.stringify(rec), 7200);
    return fail(rec.tries >= OTP.maxTries ? "too-many-tries" : "wrong-code", rec.tries >= OTP.maxTries ? 429 : 400, { triesLeft: Math.max(0, OTP.maxTries - rec.tries) });
  }
  await store.put(key, JSON.stringify({ sent: rec.sent }), 7200);   // a code works once; the send history stays for the limits

  const { token, exp } = await makeToken(id, ctx);
  const board = await loadBoard(store);
  const entry = board.players[id];
  return reply(200, { token, exp, known: !!entry, me: entry && !entry.h ? meInfo(ranking(board, "all", weekId(now)), id) : null });
}

// ---- the leaderboard -------------------------------------------------------------------------------

async function sync(req, ctx) {
  const { store, now } = ctx;
  const auth = await authenticate(req, ctx);
  if (!auth) return unauthorized(req, ctx);
  const body = req.body;
  const name = cleanName(body && body.name);
  if (!NAME_RE.test(name)) return fail("bad-name");
  const st = checkStats(body.stats, now);
  if (!st) return fail("bad-stats");

  const board = await loadBoard(store);
  const prev = board.players[auth.id];
  if (prev && now - prev.u < LIMITS.minSyncGapMs) return fail("too-fast", 429);

  const act = checkActivity(body.stats.act);
  board.players[auth.id] = {
    n: displayName(name), s: round1(st.score), b: round1(st.best), a: Math.round(st.acc), q: st.sessions, l: st.lessons,
    w: st.week, ws: round1(st.wk), u: now, h: body.visible === false ? 1 : 0,
    c: (prev && prev.c) || now,                 // first seen
    i: act || (prev && prev.i) || null,         // usage numbers
  };
  const ids = Object.keys(board.players);
  if (ids.length > LIMITS.maxPlayers) {
    ids.sort((a, b) => board.players[a].s - board.players[b].s || board.players[a].u - board.players[b].u);
    for (const old of ids.slice(0, ids.length - LIMITS.maxPlayers)) delete board.players[old];
  }
  await store.put("board", JSON.stringify(board));

  const wk = weekId(now);
  const out = { ok: true, me: meInfo(ranking(board, "all", wk), auth.id), meWeek: meInfo(ranking(board, "week", wk), auth.id) };
  if (auth.exp - now < TOKEN.refreshMs) Object.assign(out, await makeToken(auth.id, ctx));   // a fresh token before this one runs out
  return reply(200, out);
}

// The owner's view of every player. Only the owner's key opens it, and wrong keys are counted per visitor address.
async function adminPlayers(req, ctx) {
  const { store, secrets, now, ip } = ctx;
  if (!secrets.adminKey) return fail("admin-not-configured", 503);
  let tryKey = null;
  let tries = [];
  if (ip) {
    tryKey = "adm:" + (await sha(`${secrets.salt}:adm:${ip}`)).slice(0, 16);
    tries = (parse(await store.get(tryKey)) || []).filter((t) => now - t < HOUR);
    if (tries.length >= ADMIN_TRIES_PER_HOUR) return fail("too-many", 429, { retryAfter: Math.ceil((HOUR - (now - tries[0])) / 1000) });
  }
  if (!req.token || !sameText(req.token, secrets.adminKey)) {
    if (tryKey) await store.put(tryKey, JSON.stringify([...tries, now]), 3700);
    return fail("bad-admin-key", 401);
  }
  const wk = weekId(now);
  const players = Object.entries((await loadBoard(store)).players).map(([id, p]) => ({
    id: id.slice(0, 8), name: p.n, joined: p.c || null, lastSeen: p.u, hidden: !!p.h,
    score: p.s, best: p.b, acc: p.a, sessions: p.q, lessons: p.l, weekBest: p.w === wk ? p.ws : 0,
    siteMs: p.i ? p.i.si : null, typedMs: p.i ? p.i.ty : null, streak: p.i ? p.i.st : null, streakDays: p.i ? p.i.sd : null,
    activeDays: p.i ? p.i.ad : null, firstDay: p.i && p.i.f ? p.i.f : null, days: p.i ? p.i.d : [],
  }));
  players.sort((a, b) => b.lastSeen - a.lastSeen);
  return reply(200, { now, week: wk, total: players.length, players });
}

async function boardRoute(req, ctx) {
  const { store, now } = ctx;
  const scope = req.query.get("scope") === "week" ? "week" : "all";
  const wk = weekId(now);
  const rows = ranking(await loadBoard(store), scope, wk);
  const auth = req.token ? await authenticate(req, ctx) : null;
  const id = auth ? auth.id : "";
  const me = id ? meInfo(rows, id) : null;
  const from = me ? Math.max(10, me.rank - 3) : 0;
  const around = me && me.rank > 10 ? rows.slice(from, me.rank + 2).map((r, k) => rowView(r, from + k, id)) : [];
  return reply(200, { scope, week: wk, total: rows.length, top: rows.slice(0, 10).map((r, i) => rowView(r, i, id)), around, me });
}

async function remove(req, ctx) {
  const auth = await authenticate(req, ctx);
  if (!auth) return unauthorized(req, ctx);
  const board = await loadBoard(ctx.store);
  delete board.players[auth.id];
  await ctx.store.put("board", JSON.stringify(board));
  return reply(200, { ok: true });
}

// ---- certificates ----------------------------------------------------------------------------------

async function issue(req, ctx) {
  const { store, secrets, now } = ctx;
  const auth = await authenticate(req, ctx);
  if (!auth) return unauthorized(req, ctx);
  const body = req.body || {};
  const tier = body.tier;
  if (!Object.prototype.hasOwnProperty.call(TIER_LESSONS, tier)) return fail("bad-tier");
  const name = cleanName(body.name);
  if (!NAME_RE.test(name)) return fail("bad-name");
  const wpm = Number(body.wpm);
  const acc = Number(body.acc);
  if (!(wpm >= 0 && wpm <= LIMITS.maxWpm) || !(acc >= 0 && acc <= 100)) return fail("bad-stats");

  const entry = (await loadBoard(store)).players[auth.id];
  if (!entry || entry.l < TIER_LESSONS[tier]) return fail("not-eligible", 403);

  const serial = (await sha(`${auth.id}:${tier}:${secrets.salt}`)).slice(0, 8).toUpperCase();
  const payload = {
    v: 1, n: name, t: tier, w: Math.round(wpm), a: Math.round(acc),
    d: new Date(now).toISOString().slice(0, 10), i: `TL-${serial.slice(0, 4)}-${serial.slice(4)}`,
  };
  const p = b64url(enc.encode(JSON.stringify(payload)));
  return reply(200, { code: `${p}.${await signPayload(p, secrets.signKey)}`, payload });
}

async function verify(req, { secrets }) {
  const code = req.query.get("c") || "";
  const dot = code.lastIndexOf(".");
  if (code.length > LIMITS.maxCodeLength || dot < 1) return reply(200, { valid: false });
  const p = code.slice(0, dot);
  if (!sameText(await signPayload(p, secrets.signKey), code.slice(dot + 1))) return reply(200, { valid: false });
  try { return reply(200, { valid: true, cert: JSON.parse(new TextDecoder().decode(fromB64url(p))) }); }
  catch (e) { return reply(200, { valid: false }); }
}

// req: { method, route: ["otp", "send"], query: URLSearchParams, body: object | null, token?: string }
// ctx: { store: { get(key), put(key, text, ttlSeconds?) }, secrets: { salt, signKey, adminKey? }, mail?: async ({ to, subject, text, html }), ip?, now?: ms }
export async function handle(req, ctx) {
  const context = { ...ctx, now: ctx.now == null ? Date.now() : ctx.now };
  const path = req.route.join("/");
  try {
    if (req.method === "GET" && path === "health") return reply(200, { ok: true, week: weekId(context.now), mail: !!ctx.mail });
    if (!ctx.secrets || !ctx.secrets.salt || !ctx.secrets.signKey) return fail("not-configured", 503);
    switch (`${req.method} ${path}`) {
      case "POST otp/send": return await otpSend(req, context);
      case "POST otp/verify": return await otpVerify(req, context);
      case "POST sync": return await sync(req, context);
      case "GET board": return await boardRoute(req, context);
      case "GET admin/players": return await adminPlayers(req, context);
      case "POST delete": return await remove(req, context);
      case "POST certificate": return await issue(req, context);
      case "GET verify": return await verify(req, context);
      default: return fail("not-found", 404);
    }
  } catch (e) {
    return fail("server-error", 500);
  }
}
