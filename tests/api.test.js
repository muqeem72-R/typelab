const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../js/core/api.js");

const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("a good answer comes back as data", async () => {
  const calls = [];
  const api = create({ base: "/api", fetchImpl: async (url, init) => { calls.push([url, init]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
  const r = await api.otpSend("a@b.co");
  assert.deepEqual(r, { ok: true, data: { ok: true } });
  assert.equal(calls[0][0], "/api/otp/send");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), { email: "a@b.co" });
  assert.equal(calls[0][1].headers["Content-Type"], "application/json");
  assert.equal(calls[0][1].headers.Authorization, undefined, "no token, no Authorization header");
});

test("the code check sends the email and the six digits", async () => {
  const calls = [];
  const api = create({ base: "/api", fetchImpl: async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true, status: 200, json: async () => ({}) }; } });
  await api.otpVerify("a@b.co", "042917");
  assert.deepEqual(calls[0], ["/api/otp/verify", { email: "a@b.co", code: "042917" }]);
});

test("the login token goes in the Authorization header when there is one", async () => {
  const seen = [];
  let token = null;
  const api = create({ base: "/api", token: () => token, fetchImpl: async (url, init) => { seen.push(init.headers && init.headers.Authorization); return { ok: true, status: 200, json: async () => ({}) }; } });
  await api.board("all");
  token = "t1.abc.def";
  await api.board("all");
  await api.sync({ name: "Anna Lee" });
  await api.remove();
  assert.deepEqual(seen, [undefined, "Bearer t1.abc.def", "Bearer t1.abc.def", "Bearer t1.abc.def"]);
});

test("GET calls build their query safely", async () => {
  const urls = [];
  const api = create({ base: "/api", fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => ({}) }; } });
  await api.board("week");
  await api.board("anything");
  await api.board("all", "time");
  await api.board("week", "<script>");
  await api.verify("a.b c");
  assert.deepEqual(urls, ["/api/board?scope=week&by=speed", "/api/board?scope=all&by=speed", "/api/board?scope=all&by=time", "/api/board?scope=week&by=speed", "/api/verify?c=a.b%20c"]);
});

test("an error answer is passed on with its reason and its details", async () => {
  const r = await create({ base: "/api", fetchImpl: respond(429, { error: "wait", retryAfter: 25 }) }).otpSend("a@b.co");
  assert.deepEqual(r, { ok: false, status: 429, error: "wait", data: { error: "wait", retryAfter: 25 }, offline: false });
  const wrong = await create({ base: "/api", fetchImpl: respond(400, { error: "wrong-code", triesLeft: 4 }) }).otpVerify("a@b.co", "000000");
  assert.equal(wrong.data.triesLeft, 4);
});

test("a server that is not there or not configured counts as offline", async () => {
  for (const status of [404, 500, 502, 503]) {
    const r = await create({ base: "/api", fetchImpl: respond(status, { error: "not-configured" }) }).health();
    assert.equal(r.ok, false);
    assert.equal(r.offline, true, "status " + status);
  }
});

test("a network failure, a timeout and a disabled client never throw", async () => {
  const down = await create({ base: "/api", fetchImpl: async () => { throw new TypeError("Failed to fetch"); } }).sync({});
  assert.deepEqual(down, { ok: false, offline: true });
  const slow = create({ base: "/api", timeoutMs: 20, fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))) });
  assert.deepEqual(await slow.health(), { ok: false, offline: true });
  assert.deepEqual(await create({ base: "/api", fetchImpl: async () => { throw new Error("must not be called"); }, enabled: false }).health(), { ok: false, offline: true });
  assert.deepEqual(await create({ base: "/api" }).health(), { ok: false, offline: true });
});

test("an answer that is not JSON still gives a clean result", async () => {
  const r = await create({ base: "/api", fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("no json"); } }) }).health();
  assert.deepEqual(r, { ok: true, data: null });
});
