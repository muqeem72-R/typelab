import test from "node:test";
import assert from "node:assert/strict";
import { handle, weekId, displayName, playerId, cleanName, TIER_LESSONS, LIMITS, OTP, TOKEN } from "../server/core.mjs";
import { createMailer, parseFrom, otpMessage } from "../server/mail.mjs";
import rank from "../js/core/rank.js";

const secrets = { salt: "test-salt", signKey: "test-sign-key" };
const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);   // Wednesday 28 October 2026, week 44

function makeApi({ mail = true, ip = "203.0.113.7" } = {}) {
  const mem = new Map();
  const outbox = [];
  const store = { get: async (k) => mem.get(k) ?? null, put: async (k, v) => { mem.set(k, v); } };
  let now = T0;
  let fail = false;
  const mailer = mail ? async (msg) => { if (fail) throw new Error("mail-failed:500"); outbox.push(msg); } : undefined;
  const call = (method, route, { body = null, query = "", token = null, from = ip } = {}) =>
    handle({ method, route: route.split("/"), query: new URLSearchParams(query), body, token }, { store, secrets, mail: mailer, ip: from, now });
  const codeFor = (email) => {
    const msgs = outbox.filter((m) => m.to === email);
    return msgs.length ? msgs[msgs.length - 1].subject.slice(0, 6) : null;
  };
  return { call, store, mem, outbox, codeFor, tick: (ms) => { now += ms; }, setNow: (ms) => { now = ms; }, now: () => now, failMail: (v) => { fail = v; } };
}

const stats = (score, extra = {}) => ({ score, best: score, acc: 96, sessions: 5, lessons: 0, wk: score, wkId: weekId(T0), ...extra });

// The whole email login: ask for a code, read it from the "inbox", send it back. Returns the session token.
async function login(api, email) {
  const sent = await api.call("POST", "otp/send", { body: { email } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const verified = await api.call("POST", "otp/verify", { body: { email, code: api.codeFor(email) } });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  return verified.body.token;
}

async function join(api, name, email, score, extra) {
  const token = await login(api, email);
  api.tick(2000);
  const s = await api.call("POST", "sync", { token, body: { name, stats: stats(score, extra) } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  api.tick(2000);
  return token;
}

const board = (api, token, query = "scope=all") => api.call("GET", "board", { token, query });

test("names are tidied and shortened for display", () => {
  assert.equal(cleanName("  Mukeem   Khan "), "Mukeem Khan");
  assert.equal(displayName("Mukeem Khan"), "Mukeem K.");
  assert.equal(displayName("Anna Maria de Souza"), "Anna S.");
  assert.equal(displayName("Priya"), "Priya");
  assert.equal(displayName("li ming"), "li M.");
});

test("the browser and the server agree on the week", () => {
  for (const ms of [T0, Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 31), Date.UTC(2027, 0, 3), Date.UTC(2024, 11, 30), Date.UTC(2021, 0, 3)]) {
    assert.equal(weekId(ms), rank.weekId(ms), new Date(ms).toISOString());
  }
  assert.equal(weekId(T0), "2026-W44");
  assert.equal(weekId(Date.UTC(2021, 0, 3)), "2020-W53");
});

test("the player id is stable, case-insensitive and does not contain the email", async () => {
  const a = await playerId("Mukeem@Example.com", "salt");
  assert.match(a, /^[a-f0-9]{24}$/);
  assert.equal(a, await playerId("  mukeem@example.com ", "salt"));
  assert.notEqual(a, await playerId("mukeem@example.com", "other-salt"));
  assert.ok(!a.includes("mukeem"));
});

// ---- email codes -----------------------------------------------------------------------------------

test("asking for a code emails a six-digit number, and says nothing else about the account", async () => {
  const api = makeApi();
  assert.equal((await api.call("POST", "otp/send", { body: { email: "nope" } })).body.error, "bad-email");
  assert.equal((await api.call("POST", "otp/send", { body: null })).body.error, "bad-email");
  const r = await api.call("POST", "otp/send", { body: { email: "Anna@Mail.com" } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, expiresIn: 600, resendIn: 30 });
  assert.equal(api.outbox.length, 1);
  const msg = api.outbox[0];
  assert.equal(msg.to, "Anna@Mail.com");
  assert.match(msg.subject, /^\d{6} is your TypeLab login code$/);
  assert.ok(msg.text.includes(msg.subject.slice(0, 6)) && msg.html.includes(msg.subject.slice(0, 3) + " " + msg.subject.slice(3, 6)));
  assert.ok(!JSON.stringify(r.body).includes("anna"), "the answer never repeats the email");
});

test("login says so plainly when email sending is not set up", async () => {
  const api = makeApi({ mail: false });
  const r = await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "mail-not-configured");
  assert.equal((await api.call("GET", "health")).body.mail, false);
  assert.equal((await makeApi().call("GET", "health")).body.mail, true);
});

test("the right code logs in once; the same code cannot be used twice", async () => {
  const api = makeApi();
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const code = api.codeFor("a@b.co");
  const ok = await api.call("POST", "otp/verify", { body: { email: "A@B.co", code } });
  assert.equal(ok.status, 200);
  assert.match(ok.body.token, /^t1\.[\w-]+\.[\w-]{22}$/);
  assert.equal(ok.body.known, false);
  assert.equal(ok.body.exp, T0 + TOKEN.lifeMs);
  assert.ok(!JSON.stringify(ok.body).includes("a@b.co"));
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code } })).body.error, "code-expired");
});

test("a wrong or malformed code is refused and counted", async () => {
  const api = makeApi();
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const code = api.codeFor("a@b.co");
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: "12345" } })).body.error, "bad-code");
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: "abcdef" } })).body.error, "bad-code");
  const r1 = await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: wrong } });
  assert.deepEqual([r1.status, r1.body.error, r1.body.triesLeft], [400, "wrong-code", 4]);
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "x@y.co", code: wrong } })).body.error, "code-expired", "nobody asked for a code for this email");
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code } })).status, 200, "the right code still works after one mistake");
});

test("five wrong guesses lock the code, even if the next guess is right", async () => {
  const api = makeApi();
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const code = api.codeFor("a@b.co");
  const wrong = code === "000000" ? "111111" : "000000";
  let last;
  for (let i = 0; i < OTP.maxTries; i++) last = await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: wrong } });
  assert.deepEqual([last.status, last.body.error], [429, "too-many-tries"]);
  const late = await api.call("POST", "otp/verify", { body: { email: "a@b.co", code } });
  assert.deepEqual([late.status, late.body.error], [429, "too-many-tries"]);
  api.tick(OTP.resendGapMs + 1000);
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: api.codeFor("a@b.co") } })).status, 200, "a fresh code starts clean");
});

test("a code stops working after ten minutes", async () => {
  const api = makeApi();
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const code = api.codeFor("a@b.co");
  api.tick(OTP.ttlMs - 1000);
  const almost = await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: code === "000000" ? "111111" : "000000" } });
  assert.equal(almost.body.error, "wrong-code");
  api.tick(2000);
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code } })).body.error, "code-expired");
});

test("a new code replaces the old one", async () => {
  const api = makeApi();
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const first = api.codeFor("a@b.co");
  api.tick(OTP.resendGapMs + 1);
  await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  const second = api.codeFor("a@b.co");
  if (first !== second) assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: first } })).status, 400, "the first code no longer works");
  assert.equal((await api.call("POST", "otp/verify", { body: { email: "a@b.co", code: second } })).status, 200);
});

test("codes are well spread and never short", async () => {
  const api = makeApi();
  const codes = new Set();
  for (let i = 0; i < 40; i++) {
    await api.call("POST", "otp/send", { body: { email: `user${i}@b.co` }, from: `10.0.0.${i}` });
    const c = api.codeFor(`user${i}@b.co`);
    assert.match(c, /^\d{6}$/);
    codes.add(c);
  }
  assert.ok(codes.size > 35, `only ${codes.size} different codes in 40`);
});

test("one email can only be asked for a code every 30 seconds and five times an hour", async () => {
  const api = makeApi();
  assert.equal((await api.call("POST", "otp/send", { body: { email: "a@b.co" } })).status, 200);
  api.tick(5000);
  const soon = await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  assert.deepEqual([soon.status, soon.body.error, soon.body.retryAfter], [429, "wait", 25]);
  assert.equal(api.outbox.length, 1, "no second email was sent");
  for (let i = 1; i < OTP.maxPerHour; i++) {
    api.tick(OTP.resendGapMs + 1000);
    assert.equal((await api.call("POST", "otp/send", { body: { email: "a@b.co" } })).status, 200, "send " + (i + 1));
  }
  api.tick(OTP.resendGapMs + 1000);
  const sixth = await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  assert.deepEqual([sixth.status, sixth.body.error], [429, "too-many"]);
  assert.ok(sixth.body.retryAfter > 60 * 30);
  assert.equal(api.outbox.length, OTP.maxPerHour);
  api.tick(3600 * 1000);
  assert.equal((await api.call("POST", "otp/send", { body: { email: "a@b.co" } })).status, 200, "an hour later it works again");
});

test("one visitor address cannot ask for codes to many inboxes", async () => {
  const api = makeApi();
  for (let i = 0; i < OTP.ipPerHour; i++) assert.equal((await api.call("POST", "otp/send", { body: { email: `u${i}@b.co` } })).status, 200);
  const next = await api.call("POST", "otp/send", { body: { email: "another@b.co" } });
  assert.deepEqual([next.status, next.body.error], [429, "too-many"]);
  assert.equal((await api.call("POST", "otp/send", { body: { email: "another@b.co" }, from: "198.51.100.9" })).status, 200, "a different visitor is not affected");
  api.tick(3600 * 1000 + 1);
  assert.equal((await api.call("POST", "otp/send", { body: { email: "another2@b.co" } })).status, 200);
});

test("a failed email is reported, and the attempt still counts", async () => {
  const api = makeApi();
  api.failMail(true);
  const r = await api.call("POST", "otp/send", { body: { email: "a@b.co" } });
  assert.deepEqual([r.status, r.body.error], [502, "mail-failed"]);
  api.failMail(false);
  assert.equal((await api.call("POST", "otp/send", { body: { email: "a@b.co" } })).body.error, "wait", "no free retries to spam an inbox");
  api.tick(OTP.resendGapMs + 1);
  assert.equal((await api.call("POST", "otp/send", { body: { email: "a@b.co" } })).status, 200);
});

// ---- tokens ----------------------------------------------------------------------------------------

test("changing things needs a login token", async () => {
  const api = makeApi();
  const body = { name: "Anna Lee", stats: stats(40) };
  for (const [route, extra] of [["sync", body], ["delete", {}], ["certificate", { tier: "core", name: "Anna Lee", wpm: 40, acc: 95 }]]) {
    const none = await api.call("POST", route, { body: extra });
    assert.deepEqual([none.status, none.body.error], [401, "bad-token"], route);
    const junk = await api.call("POST", route, { body: extra, token: "t1.abc.def" });
    assert.equal(junk.status, 401, route);
  }
});

test("a token that was changed, signed with another key, or has run out is refused", async () => {
  const api = makeApi();
  const token = await login(api, "a@b.co");
  api.tick(2000);
  const [v, p, sig] = token.split(".");
  const swapped = Buffer.from(JSON.stringify({ i: "0".repeat(24), e: T0 + TOKEN.lifeMs })).toString("base64url");
  for (const bad of [`${v}.${swapped}.${sig}`, `${v}.${p}.${sig.slice(0, -1)}x`, `${v}.${p}`, `t2.${p}.${sig}`, ""]) {
    assert.equal((await api.call("POST", "sync", { token: bad, body: { name: "Anna Lee", stats: stats(40) } })).status, 401, bad.slice(0, 20));
  }
  assert.equal((await api.call("POST", "sync", { token, body: { name: "Anna Lee", stats: stats(40) } })).status, 200);
  const other = await handle({ method: "POST", route: ["sync"], query: new URLSearchParams(), body: { name: "Anna Lee", stats: stats(40) }, token }, { store: api.store, secrets: { salt: "test-salt", signKey: "a-different-key" }, now: api.now() + 5000 });
  assert.equal(other.status, 401);
  api.setNow(T0 + TOKEN.lifeMs + 1);
  const late = await api.call("POST", "sync", { token, body: { name: "Anna Lee", stats: stats(40, { wkId: weekId(T0 + TOKEN.lifeMs + 1) }) } });
  assert.deepEqual([late.status, late.body.error], [401, "expired"]);
});

test("a token is renewed when it is close to running out", async () => {
  const api = makeApi();
  const token = await login(api, "a@b.co");
  api.tick(2000);
  const early = await api.call("POST", "sync", { token, body: { name: "Anna Lee", stats: stats(40) } });
  assert.equal(early.body.token, undefined, "a young token is left alone");
  api.setNow(T0 + TOKEN.lifeMs - TOKEN.refreshMs + 60000);
  const late = await api.call("POST", "sync", { token, body: { name: "Anna Lee", stats: stats(40, { wkId: weekId(api.now()) }) } });
  assert.match(late.body.token, /^t1\./);
  assert.ok(late.body.exp > T0 + TOKEN.lifeMs);
  api.tick(2000);
  assert.equal((await api.call("POST", "sync", { token: late.body.token, body: { name: "Anna Lee", stats: stats(41, { wkId: weekId(api.now()) }) } })).status, 200);
});

test("the same email always gives the same player, on any device", async () => {
  const api = makeApi();
  const a = await login(api, "a@b.co");
  api.tick(OTP.resendGapMs + 1000);
  const b = await login(api, "A@B.CO");
  api.tick(2000);
  await api.call("POST", "sync", { token: a, body: { name: "Anna Lee", stats: stats(44) } });
  api.tick(2000);
  const seen = await board(api, b);
  assert.equal(seen.body.me.score, 44, "the second login sees the first login's score");
});

// ---- the leaderboard --------------------------------------------------------------------------------

test("sync stores a player, ranks by score and returns the rank", async () => {
  const api = makeApi();
  const tokens = [];
  tokens.push(await join(api, "Ann One", "a1@x.io", 40));
  tokens.push(await join(api, "Bob Two", "b2@x.io", 55));
  tokens.push(await join(api, "Cy Three", "c3@x.io", 47));
  const b = await board(api, tokens[0]);
  assert.equal(b.body.total, 3);
  assert.deepEqual(b.body.top.map((r) => [r.rank, r.name, r.score]), [[1, "Bob T.", 55], [2, "Cy T.", 47], [3, "Ann O.", 40]]);
  assert.deepEqual(b.body.me, { rank: 3, total: 3, score: 40, percent: 100 });
  assert.equal(b.body.top[2].you, true);
  assert.equal(b.body.top[0].you, false);
  assert.ok(!JSON.stringify(b.body).includes("x.io"));
  const stranger = await board(api, null);
  assert.equal(stranger.body.me, null, "without a token nobody is 'you'");
  assert.equal(stranger.body.top.some((r) => r.you), false);
});

test("ties go to whoever reached the score first", async () => {
  const api = makeApi();
  await join(api, "First Player", "f@x.io", 50);
  const second = await join(api, "Second Player", "s@x.io", 50);
  const b = await board(api, second);
  assert.deepEqual(b.body.top.map((r) => r.name), ["First P.", "Second P."]);
  assert.equal(b.body.me.rank, 2);
});

test("a player outside the top ten sees the rows around their own rank", async () => {
  const api = makeApi();
  const tokens = [];
  for (let i = 0; i < 15; i++) tokens.push(await join(api, `Player ${String.fromCharCode(65 + i)}${i}`, `p${i}@x.io`, 100 - i * 3));
  const b = await board(api, tokens[12]);
  assert.equal(b.body.total, 15);
  assert.equal(b.body.top.length, 10);
  assert.equal(b.body.me.rank, 13);
  assert.equal(b.body.me.percent, Math.ceil((13 / 15) * 100));
  assert.deepEqual(b.body.around.map((r) => r.rank), [11, 12, 13, 14, 15]);
  assert.equal(b.body.around.find((r) => r.you).rank, 13);
});

test("the weekly board only counts this week's scores", async () => {
  const api = makeApi();
  const a = await join(api, "Week Ann", "wa@x.io", 60, { wk: 50 });
  const b = await join(api, "Week Bob", "wb@x.io", 40, { wk: 58 });
  let w = await board(api, a, "scope=week");
  assert.deepEqual(w.body.top.map((r) => [r.name, r.score]), [["Week B.", 58], ["Week A.", 50]]);
  assert.equal(w.body.week, "2026-W44");
  api.setNow(T0 + 8 * 86400000);
  w = await board(api, b, "scope=week");
  assert.equal(w.body.total, 0);
  assert.equal((await board(api, b)).body.total, 2);
});

test("a weekly score reported for another week is ignored", async () => {
  const api = makeApi();
  const token = await join(api, "Old Week", "ow@x.io", 50, { wkId: "2026-W10", wk: 50 });
  assert.equal((await board(api, token, "scope=week")).body.total, 0);
});

test("impossible or malformed scores are rejected", async () => {
  const api = makeApi();
  const token = await login(api, "c@x.io");
  const send = async (st) => { api.tick(2000); return (await api.call("POST", "sync", { token, body: { name: "Cheat Er", stats: st } })).body.error; };
  assert.equal(await send(stats(900)), "bad-stats");
  assert.equal(await send(stats(-5)), "bad-stats");
  assert.equal(await send({ ...stats(50), acc: 130 }), "bad-stats");
  assert.equal(await send({ ...stats(50), score: 80, best: 50 }), "bad-stats");
  assert.equal(await send({ ...stats(50), score: "fast" }), "bad-stats");
  assert.equal(await send(null), "bad-stats");
  api.tick(2000);
  assert.equal((await api.call("POST", "sync", { token, body: { name: "<script>", stats: stats(50) } })).body.error, "bad-name");
  assert.equal(await send(stats(LIMITS.maxWpm)), undefined);
});

test("syncing twice in a row is rate limited", async () => {
  const api = makeApi();
  const token = await login(api, "ff@x.io");
  api.tick(2000);
  assert.equal((await api.call("POST", "sync", { token, body: { name: "Fast Fin", stats: stats(40) } })).status, 200);
  api.tick(200);
  assert.equal((await api.call("POST", "sync", { token, body: { name: "Fast Fin", stats: stats(41) } })).status, 429);
  api.tick(3000);
  assert.equal((await api.call("POST", "sync", { token, body: { name: "Fast Fin", stats: stats(41) } })).status, 200);
});

test("a hidden player is not listed or ranked but can still sync", async () => {
  const api = makeApi();
  const shown = await join(api, "Shown Sam", "ss@x.io", 40);
  const token = await login(api, "hh@x.io");
  api.tick(2000);
  const r = await api.call("POST", "sync", { token, body: { name: "Hidden Hal", visible: false, stats: stats(70) } });
  assert.equal(r.body.me, null);
  const b = await board(api, shown);
  assert.equal(b.body.total, 1);
  assert.deepEqual(b.body.top.map((x) => x.name), ["Shown S."]);
});

test("delete removes the player from the board, and only the player can do it", async () => {
  const api = makeApi();
  const mine = await join(api, "Gone Gail", "gg@x.io", 45);
  const other = await join(api, "Stay Stu", "st@x.io", 30);
  assert.equal((await api.call("POST", "delete", { token: mine })).status, 200);
  const b = await board(api, other);
  assert.deepEqual(b.body.top.map((x) => x.name), ["Stay S."]);
  assert.equal((await api.call("POST", "delete", {})).status, 401);
});

test("a damaged board starts again empty instead of failing", async () => {
  const api = makeApi();
  api.mem.set("board", "{not json");
  const b = await board(api, null);
  assert.equal(b.status, 200);
  assert.equal(b.body.total, 0);
});

// ---- certificates -------------------------------------------------------------------------------------

test("certificates need the lessons to have been synced first", async () => {
  const api = makeApi();
  const token = await join(api, "Cert Cathy", "cc@x.io", 52, { lessons: 17 });
  const ask = (tier) => api.call("POST", "certificate", { token, body: { tier, name: "Cert Cathy", wpm: 52, acc: 97 } });
  assert.equal((await ask("core")).body.error, "not-eligible");
  api.tick(2000);
  await api.call("POST", "sync", { token, body: { name: "Cert Cathy", stats: stats(52, { lessons: 18 }) } });
  const core = await ask("core");
  assert.equal(core.status, 200);
  assert.equal(core.body.payload.n, "Cert Cathy");
  assert.equal(core.body.payload.t, "core");
  assert.equal(core.body.payload.d, "2026-10-28");
  assert.match(core.body.payload.i, /^TL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal((await ask("programmer")).body.error, "not-eligible");
  assert.equal((await ask("gold")).body.error, "bad-tier");
  assert.equal(TIER_LESSONS.core, 18);
  assert.equal(TIER_LESSONS.programmer, 24);
});

test("a certificate verifies, and any change to it breaks the signature", async () => {
  const api = makeApi();
  const token = await join(api, "Sign Sue", "sg@x.io", 61, { lessons: 24 });
  const { body: { code, payload } } = await api.call("POST", "certificate", { token, body: { tier: "programmer", name: "Sign Sue", wpm: 61, acc: 98 } });
  const ok = await api.call("GET", "verify", { query: "c=" + encodeURIComponent(code) });
  assert.equal(ok.body.valid, true);
  assert.deepEqual(ok.body.cert, payload);
  const [p, sig] = code.split(".");
  const forged = Buffer.from(JSON.stringify({ ...payload, n: "Someone Else" })).toString("base64url");
  for (const bad of [`${forged}.${sig}`, `${p}.${sig.slice(0, -1)}A`, `${p}.`, p, "", "x.y", `${p}.${"A".repeat(22)}`]) {
    assert.equal((await api.call("GET", "verify", { query: "c=" + encodeURIComponent(bad) })).body.valid, false, bad);
  }
  assert.equal((await api.call("GET", "verify", { query: "c=" + "a".repeat(5000) })).body.valid, false);
});

test("a login token cannot be passed off as a certificate, or the other way round", async () => {
  const api = makeApi();
  const token = await join(api, "Mix Max", "mx@x.io", 50, { lessons: 24 });
  const { body: { code } } = await api.call("POST", "certificate", { token, body: { tier: "core", name: "Mix Max", wpm: 50, acc: 95 } });
  assert.equal((await api.call("GET", "verify", { query: "c=" + encodeURIComponent(token.replace(/^t1\./, "")) })).body.valid, false);
  api.tick(2000);
  assert.equal((await api.call("POST", "sync", { token: "t1." + code, body: { name: "Mix Max", stats: stats(50) } })).status, 401);
});

test("the same player and tier always get the same certificate number", async () => {
  const api = makeApi();
  const token = await join(api, "Same Sid", "sm@x.io", 50, { lessons: 24 });
  const ask = (tier) => api.call("POST", "certificate", { token, body: { tier, name: "Same Sid", wpm: 50, acc: 95 } });
  const a = await ask("core");
  const b = await ask("core");
  const c = await ask("programmer");
  assert.equal(a.body.payload.i, b.body.payload.i);
  assert.notEqual(a.body.payload.i, c.body.payload.i);
});

test("the API says it is not configured when the secrets are missing", async () => {
  const noSecrets = await handle({ method: "POST", route: ["otp", "send"], query: new URLSearchParams(), body: { email: "a@b.co" } }, { store: { get: async () => null, put: async () => {} }, secrets: {} });
  assert.equal(noSecrets.status, 503);
  assert.equal((await handle({ method: "GET", route: ["health"], query: new URLSearchParams() }, { store: {}, secrets: {} })).status, 200);
});

test("unknown routes are 404 and the board is pruned to its limit", async () => {
  const api = makeApi();
  assert.equal((await api.call("GET", "nothing")).status, 404);
  assert.equal((await api.call("POST", "board")).status, 404);
  assert.equal((await api.call("POST", "login", { body: { name: "A B", email: "a@b.co" } })).status, 404, "the old password-free login is gone");
  const full = { v: 1, players: {} };
  for (let i = 0; i < LIMITS.maxPlayers + 5; i++) full.players[i.toString(16).padStart(24, "0")] = { n: "P", s: i + 1, b: i + 1, a: 90, q: 1, l: 0, w: "", ws: 0, u: i, h: 0 };
  api.mem.set("board", JSON.stringify(full));
  api.tick(1000);
  const token = await join(api, "New Nia", "nn@x.io", 120);
  const after = JSON.parse(api.mem.get("board"));
  assert.equal(Object.keys(after.players).length, LIMITS.maxPlayers);
  assert.ok(!after.players["0".padStart(24, "0")], "the lowest score was dropped");
  assert.ok(token);
});

// ---- the mail adapter ----------------------------------------------------------------------------------

test("the sender text is read in both usual forms", () => {
  assert.deepEqual(parseFrom("TypeLab <login@example.com>"), { name: "TypeLab", email: "login@example.com" });
  assert.deepEqual(parseFrom('"Type Lab" <login@example.com>'), { name: "Type Lab", email: "login@example.com" });
  assert.deepEqual(parseFrom("login@example.com"), { name: "", email: "login@example.com" });
  assert.equal(parseFrom("not an address"), null);
  assert.equal(parseFrom(""), null);
});

test("there is no mailer until the provider, key and sender are all set", () => {
  assert.equal(createMailer({}), null);
  assert.equal(createMailer({ MAIL_PROVIDER: "brevo", MAIL_API_KEY: "k" }), null);
  assert.equal(createMailer({ MAIL_PROVIDER: "carrier-pigeon", MAIL_API_KEY: "k", MAIL_FROM: "a@b.co" }), null);
  assert.equal(typeof createMailer({ MAIL_PROVIDER: "BREVO", MAIL_API_KEY: "k", MAIL_FROM: "TypeLab <a@b.co>" }), "function");
});

test("Brevo and Resend each get the request they expect", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 201 }; };
  const msg = { to: "anna@mail.com", subject: "123456 is your TypeLab login code", text: "t", html: "<p>h</p>" };

  await createMailer({ MAIL_PROVIDER: "brevo", MAIL_API_KEY: "brevo-key", MAIL_FROM: "TypeLab <me@x.io>" }, fetchImpl)(msg);
  assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["api-key"], "brevo-key");
  assert.deepEqual(calls[0].body, { sender: { name: "TypeLab", email: "me@x.io" }, to: [{ email: "anna@mail.com" }], subject: msg.subject, htmlContent: "<p>h</p>", textContent: "t" });

  await createMailer({ MAIL_PROVIDER: "resend", MAIL_API_KEY: "resend-key", MAIL_FROM: "TypeLab <me@x.io>" }, fetchImpl)(msg);
  assert.equal(calls[1].url, "https://api.resend.com/emails");
  assert.equal(calls[1].init.headers.Authorization, "Bearer resend-key");
  assert.deepEqual(calls[1].body, { from: "TypeLab <me@x.io>", to: ["anna@mail.com"], subject: msg.subject, html: "<p>h</p>", text: "t" });
});

test("a provider that says no makes the send fail", async () => {
  const send = createMailer({ MAIL_PROVIDER: "brevo", MAIL_API_KEY: "k", MAIL_FROM: "a@b.co" }, async () => ({ ok: false, status: 401 }));
  await assert.rejects(() => send({ to: "x@y.co", subject: "s", text: "t", html: "h" }), /mail-failed:401/);
});

test("the email text carries the code and the expiry", () => {
  const m = otpMessage("042917", 10);
  assert.equal(m.subject, "042917 is your TypeLab login code");
  assert.ok(m.text.includes("042917") && m.text.includes("10 minutes") && /ignore this email/.test(m.text));
  assert.ok(m.html.includes("042 917"));
});
