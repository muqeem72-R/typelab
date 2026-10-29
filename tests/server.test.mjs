import test from "node:test";
import assert from "node:assert/strict";
import { handle, weekId, displayName, playerId, cleanName, TIER_LESSONS, LIMITS, OTP, TOKEN } from "../server/core.mjs";
import { createMailer, parseFrom, otpMessage } from "../server/mail.mjs";
import rank from "../js/core/rank.js";

const secrets = { salt: "test-salt", signKey: "test-sign-key" };
const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);   // Wednesday 28 October 2026, week 44

function makeApi({ mail = true, ip = "203.0.113.7", adminKey = null } = {}) {
  const mem = new Map();
  const outbox = [];
  const store = { get: async (k) => mem.get(k) ?? null, put: async (k, v) => { mem.set(k, v); } };
  let now = T0;
  let fail = false;
  const mailer = mail ? async (msg) => { if (fail) throw new Error("mail-failed:500"); outbox.push(msg); } : undefined;
  const call = (method, route, { body = null, query = "", token = null, from = ip } = {}) =>
    handle({ method, route: route.split("/"), query: new URLSearchParams(query), body, token }, { store, secrets: adminKey ? { ...secrets, adminKey } : secrets, mail: mailer, ip: from, now });
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
  assert.deepEqual(b.body.top.map((r) => [r.rank, r.name, r.speed]), [[1, "Bob T.", 55], [2, "Cy T.", 47], [3, "Ann O.", 40]]);
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
  assert.deepEqual(w.body.top.map((r) => [r.name, r.speed]), [["Week B.", 58], ["Week A.", 50]]);
  assert.equal(w.body.week, "2026-W44");
  api.setNow(T0 + 8 * 86400000);
  w = await board(api, b, "scope=week");
  assert.equal(w.body.total, 2, "everyone is still listed in a new week");
  assert.deepEqual(w.body.top.map((r) => r.speed), [0, 0], "with nothing typed yet this week");
  assert.equal((await board(api, b)).body.total, 2);
});

test("a weekly score reported for another week is ignored", async () => {
  const api = makeApi();
  const token = await join(api, "Old Week", "ow@x.io", 50, { wkId: "2026-W10", wk: 50 });
  const w = (await board(api, token, "scope=week")).body;
  assert.equal(w.top[0].speed, 0, "the player is listed, with no speed this week");
  assert.equal((await board(api, token)).body.top[0].speed, 50, "and with 50 over all time");
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

// ---- usage numbers and the owner view ----------------------------------------------------------------

const OWNER = "owner-key-0123456789abcdef";
const usage = (extra = {}) => ({
  site: 5400000, typed: 3600000, todaySite: 600000, todayTyped: 420000, streak: 2, streakDays: 4, activeDays: 6, first: 20400,
  days: [[20403, 12, 20], [20404, 25, 40], [20405, 7, 11]], ...extra,
});
const adminList = (api, key = OWNER, extra = {}) => api.call("GET", "admin/players", { token: key, ...extra });

test("a player's usage numbers are kept, and the owner can read them with the owner's key", async () => {
  const api = makeApi({ adminKey: OWNER });
  const token = await login(api, "mukeem@example.com");
  api.tick(2000);
  const s = await api.call("POST", "sync", { token, body: { name: "Mukeem Khan", stats: stats(52, { act: usage() }) } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const r = await adminList(api);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 1);
  const p = r.body.players[0];
  assert.equal(p.name, "Mukeem K.");
  assert.equal(p.siteMs, 5400000);
  assert.equal(p.typedMs, 3600000);
  assert.equal(p.streak, 2);
  assert.equal(p.streakDays, 4);
  assert.equal(p.activeDays, 6);
  assert.equal(p.firstDay, 20400);
  assert.deepEqual(p.days, [[20403, 12, 20], [20404, 25, 40], [20405, 7, 11]]);
  assert.equal(p.score, 52);
  assert.equal(p.joined, T0 + 2000, "first seen");
  assert.equal(p.lastSeen, T0 + 2000);
  assert.match(p.id, /^[a-f0-9]{8}$/);
  assert.ok(!JSON.stringify(r.body).includes("example.com"), "the email address is nowhere in the owner view");
});

test("the owner view lists hidden players too, the newest visit first, and keeps the first-seen time", async () => {
  const api = makeApi({ adminKey: OWNER });
  const a = await join(api, "Anna Lee", "anna@example.com", 40, { act: usage({ site: 1000 }) });
  const b = await login(api, "ben@example.com");
  api.tick(2000);
  await api.call("POST", "sync", { token: b, body: { name: "Ben Ray", visible: false, stats: stats(30, { act: usage({ site: 2000 }) }) } });
  api.tick(60000);
  await api.call("POST", "sync", { token: a, body: { name: "Anna Lee", stats: stats(41, { act: usage({ site: 1500 }) }) } });
  const list = (await adminList(api)).body.players;
  assert.deepEqual(list.map((p) => p.name), ["Anna L.", "Ben R."], "latest visit first");
  assert.equal(list[1].hidden, true);
  assert.equal(list[0].siteMs, 1500, "the newest report replaces the old one");
  assert.ok(list[0].joined < list[0].lastSeen, "first seen stays as it was");
  const pub = JSON.stringify((await board(api, a)).body);
  assert.ok(!pub.includes("siteMs") && !pub.includes("typedMs") && !pub.includes("1500"), "the public board shows none of it");
});

test("the owner view is off without an owner key, and a player's login token does not open it", async () => {
  const off = makeApi();
  const t = await join(off, "Anna Lee", "anna@example.com", 40);
  assert.equal((await adminList(off, OWNER)).status, 503);
  assert.equal((await adminList(off, OWNER)).body.error, "admin-not-configured");
  const on = makeApi({ adminKey: OWNER });
  const token = await join(on, "Anna Lee", "anna@example.com", 40);
  assert.equal((await adminList(on, token)).status, 401, "a player's token is not the owner's key");
  assert.equal((await adminList(on, null)).status, 401, "no key at all");
  assert.equal((await adminList(on, OWNER + "x")).status, 401);
  assert.equal((await adminList(on, OWNER.slice(0, -1))).status, 401);
  assert.equal((await adminList(on, OWNER)).status, 200);
  assert.equal((await on.call("POST", "admin/players", { token: OWNER })).status, 404, "read only");
});

test("wrong owner keys are limited per visitor address", async () => {
  const api = makeApi({ adminKey: OWNER });
  for (let i = 0; i < 10; i++) assert.equal((await adminList(api, "guess" + i)).status, 401);
  const blocked = await adminList(api, "guess-eleven");
  assert.equal(blocked.status, 429);
  assert.equal((await adminList(api, OWNER)).status, 429, "while blocked even the right key waits");
  assert.equal((await adminList(api, OWNER, { from: "198.51.100.9" })).status, 200, "another address is not affected");
  api.tick(3600 * 1000 + 1000);
  assert.equal((await adminList(api, OWNER)).status, 200, "an hour later it works again");
});

test("usage numbers that look wrong are ignored, but the scores in the same sync are still taken", async () => {
  const api = makeApi({ adminKey: OWNER });
  const token = await login(api, "mukeem@example.com");
  const bad = [
    usage({ site: -5 }), usage({ typed: "lots" }), usage({ site: 1e12 }), usage({ days: "no" }), usage({ days: new Array(15).fill([20400, 1, 1]) }),
    usage({ days: [[20400, 5000, 1]] }), usage({ days: [[20400, 1]] }), usage({ days: [[3, 1, 1]] }), usage({ streak: NaN }), null, "x",
  ];
  for (const act of bad) {
    api.tick(2000);
    const s = await api.call("POST", "sync", { token, body: { name: "Mukeem Khan", stats: stats(50, { act }) } });
    assert.equal(s.status, 200, JSON.stringify(act));
  }
  const p = (await adminList(api)).body.players[0];
  assert.equal(p.score, 50);
  assert.equal(p.siteMs, null, "nothing was kept from the bad reports");
  api.tick(2000);
  await api.call("POST", "sync", { token, body: { name: "Mukeem Khan", stats: stats(50, { act: usage() }) } });
  api.tick(2000);
  await api.call("POST", "sync", { token, body: { name: "Mukeem Khan", stats: stats(55) } });   // an old browser sends none
  const q = (await adminList(api)).body.players[0];
  assert.equal(q.siteMs, 5400000, "the last good numbers stay when a sync has none");
  assert.equal(q.score, 55);
});

test("removing a player's entry removes their usage numbers too", async () => {
  const api = makeApi({ adminKey: OWNER });
  const token = await join(api, "Anna Lee", "anna@example.com", 40, { act: usage() });
  assert.equal((await adminList(api)).body.total, 1);
  await api.call("POST", "delete", { token, body: {} });
  assert.equal((await adminList(api)).body.total, 0);
});

// ---- the practice-time board ---------------------------------------------------------------------------------

const timeBoard = (api, token, scope = "all") => api.call("GET", "board", { token, query: `scope=${scope}&by=time` });
const day = (ms) => Math.floor(ms / 86400000);

test("one table lists everybody with both numbers, ordered by what the filter says", async () => {
  const api = makeApi();
  // Anna practised for 90 minutes with a slow best speed of 3; Ben is fast (55) with 10 minutes; Cy has done nothing yet
  const anna = await join(api, "Anna Lee", "anna@example.com", 0, { best: 0, wk: 0, top: 3, allAcc: 88, act: usage({ typed: 90 * 60000, streak: 5, streakDays: 6 }) });
  await join(api, "Ben Ray", "ben@example.com", 55, { act: usage({ typed: 10 * 60000 }) });
  await join(api, "Cy Dow", "cy@example.com", 0, { best: 0, wk: 0 });
  const speed = (await board(api, anna)).body;
  assert.deepEqual(speed.top.map((r) => r.name), ["Ben R.", "Anna L.", "Cy D."], "everyone is there, fastest first, even a speed of 3 or 0");
  assert.equal(speed.total, 3);
  const time = (await timeBoard(api, anna)).body;
  assert.equal(time.by, "time");
  assert.deepEqual(time.top.map((r) => r.name), ["Anna L.", "Ben R.", "Cy D."], "the same people, most practice first");
  const row = time.top[0];
  assert.deepEqual(Object.keys(row).sort(), ["acc", "days", "minutes", "name", "rank", "sessions", "speed", "streak", "you"], "every row has both numbers and nothing else");
  assert.equal(row.minutes, 90);
  assert.equal(row.speed, 3);
  assert.equal(row.acc, 88);
  assert.equal(row.streak, 5);
  assert.equal(row.days, 6);
  assert.equal(row.you, true);
  assert.equal(time.me.rank, 1);
  assert.equal(speed.me.rank, 2);
  assert.equal(time.top[2].speed, 0);
  assert.equal(time.top[2].minutes, 0);
});

test("a tie in the ordering is broken by the other number", async () => {
  const api = makeApi();
  await join(api, "Ann One", "a1@x.io", 40, { top: 40, act: usage({ typed: 20 * 60000 }) });
  await join(api, "Bob Two", "b2@x.io", 40, { top: 40, act: usage({ typed: 50 * 60000 }) });
  await join(api, "Cy Three", "c3@x.io", 30, { top: 30, act: usage({ typed: 50 * 60000 }) });
  const bySpeed = (await board(api, null)).body.top.map((r) => r.name);
  assert.deepEqual(bySpeed, ["Bob T.", "Ann O.", "Cy T."], "equal speed: more practice first");
  const byTime = (await timeBoard(api, null)).body.top.map((r) => r.name);
  assert.deepEqual(byTime, ["Bob T.", "Cy T.", "Ann O."], "equal practice: faster first");
});

test("the weekly practice-time board adds up this week's minutes only", async () => {
  const api = makeApi();
  const thisWeekDay = day(T0);                    // Wednesday of week 44
  const lastWeekDay = day(T0) - 9;
  const a = await join(api, "Anna Lee", "anna@example.com", 0, { best: 0, wk: 0, act: usage({ typed: 300 * 60000, days: [[lastWeekDay, 200, 210], [thisWeekDay - 1, 20, 25], [thisWeekDay, 15, 20]] }) });
  await join(api, "Ben Ray", "ben@example.com", 0, { best: 0, wk: 0, act: usage({ typed: 50 * 60000, days: [[lastWeekDay, 1, 1], [thisWeekDay, 40, 45]] }) });
  const week = (await timeBoard(api, a, "week")).body;
  assert.deepEqual(week.top.map((r) => [r.name, r.minutes]), [["Ben R.", 40], ["Anna L.", 35]], "last week's 200 minutes do not count");
  assert.equal(week.total, 2);
  const all = (await timeBoard(api, a, "all")).body;
  assert.deepEqual(all.top.map((r) => [r.name, r.minutes]), [["Anna L.", 300], ["Ben R.", 50]]);
});

test("hidden players are not listed, and sync answers with both ranks", async () => {
  const api = makeApi();
  const a = await join(api, "Anna Lee", "anna@example.com", 40, { act: usage({ typed: 30 * 60000 }) });
  const b = await login(api, "ben@example.com");
  api.tick(2000);
  await api.call("POST", "sync", { token: b, body: { name: "Ben Ray", visible: false, stats: stats(60, { act: usage({ typed: 999 * 60000 }) }) } });
  api.tick(2000);
  const again = await api.call("POST", "sync", { token: a, body: { name: "Anna Lee", stats: stats(40, { act: usage({ typed: 31 * 60000 }) }) } });
  assert.equal(again.body.me.rank, 1);
  assert.equal(again.body.meTime.rank, 1, "Ben is hidden, so Anna is first");
  assert.equal(again.body.meTime.score, 31);
  assert.equal(again.body.meTimeWeek.rank, 1, "no practice-time week yet, but she is still listed");
  assert.equal((await timeBoard(api, a)).body.total, 1);
  assert.equal((await board(api, a)).body.total, 1);
});

// ---- the Worker itself ------------------------------------------------------------------------------------------

import worker from "../worker/index.js";

test("the Worker answers the Google verification file exactly, and nothing like it", async () => {
  const get = (p, method = "GET") => worker.fetch(new Request("https://example.test" + p, { method }), {});
  const ok = await get("/googlec8e965a58b9d3a68.html");
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "google-site-verification: googlec8e965a58b9d3a68.html");
  assert.match(ok.headers.get("content-type"), /^text\/html/);
  assert.equal((await get("/googlec8e965a58b9d3a68.html", "HEAD")).status, 200);
  assert.equal((await get("/googleffffffffffffffff.html")).status, 404, "another file name is not verified");
  assert.equal((await get("/googlec8e965a58b9d3a68")).status, 404);
  assert.equal((await get("/nothing")).status, 404);
  const health = await get("/api/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
});
