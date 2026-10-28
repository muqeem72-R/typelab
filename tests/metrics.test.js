const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/core/metrics.js");

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`);

test("wpm counts five characters as one word", () => {
  near(M.wpm(50, 60000), 10);
  near(M.wpm(300, 60000), 60);
  assert.equal(M.wpm(10, 0), 0);
});

test("per-key speed and time are inverse", () => {
  near(M.speedFromMs(200), 60);
  near(M.msFromSpeed(60), 200);
  near(M.speedFromMs(M.msFromSpeed(35)), 35);
});

test("accuracy defaults to 100 with no keystrokes", () => {
  assert.equal(M.accuracy(0, 0), 100);
  near(M.accuracy(95, 100), 95);
});

test("intervals are clamped to a believable range", () => {
  assert.equal(M.clampInterval(5), M.MIN_MS);
  assert.equal(M.clampInterval(99999), M.MAX_MS);
  assert.equal(M.clampInterval(180), 180);
});

test("ema starts at the first sample and moves towards new ones", () => {
  assert.equal(M.ema(null, 300, 0.15), 300);
  near(M.ema(300, 200, 0.5), 250);
});

test("consistency is high for steady typing and low for erratic typing", () => {
  const steady = M.consistency([200, 205, 195, 200, 202, 198, 200]);
  const erratic = M.consistency([80, 900, 120, 1500, 90, 700, 100]);
  assert.ok(steady > 90, `steady was ${steady}`);
  assert.ok(erratic < 50, `erratic was ${erratic}`);
  assert.equal(M.consistency([200, 200]), null);
});

test("series gives one point per second with running speed and errors", () => {
  const events = [];
  for (let i = 1; i <= 10; i++) events.push({ t: i * 300, c: i, ok: i !== 4 });
  const s = M.series(events, 3000);
  assert.equal(s.length, 3);
  assert.equal(s[0].s, 1);
  near(s[0].wpm, M.wpm(3, 1000));   // 3 events by 1000 ms
  assert.equal(s[0].errors, 0);
  assert.equal(s[1].errors, 1);     // the 4th event is at 1200 ms, so it lands in second 2
  assert.equal(s[2].errors, 0);
});

test("a long run is thinned to a readable number of chart points and still ends at its end", () => {
  const events = [];
  for (let i = 1; i <= 3000; i++) events.push({ t: i * 200, c: i, ok: i % 50 !== 0 });   // 600 s of typing
  const s = M.series(events, 600000);
  assert.ok(s.length <= 120, `${s.length} points`);
  assert.equal(s[s.length - 1].s, 600);
  assert.equal(s.reduce((a, p) => a + p.errors, 0), 60, "no mistake is lost when points are merged");
  assert.ok(Math.abs(s[s.length - 1].wpm - 60) < 0.5);
  assert.equal(M.series(events.slice(0, 5), 3000).length, 3, "a short run keeps one point per second");
});

test("polyFit recovers a straight line and a parabola exactly", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7];
  const line = M.polyFit(xs, xs.map((x) => 2 * x + 3), 1);
  near(line.eval(10), 23);
  near(line.slope(4), 2);
  const quad = M.polyFit(xs, xs.map((x) => x * x - 4 * x + 1), 2);
  near(quad.eval(9), 81 - 36 + 1);
  near(quad.slope(5), 6);
});

test("projection estimates sessions to target from a rising trend", () => {
  const speeds = [20, 21, 23, 24, 26, 27, 28, 30];
  const p = M.projection(speeds, 35);
  assert.ok(p, "expected a projection");
  assert.ok(p.certainty > 0.9);
  assert.ok(p.rate > 0);
  assert.ok(p.remaining >= 3 && p.remaining <= 6, `remaining was ${p.remaining}`);
});

test("projection says 0 once the trend has reached the target", () => {
  const p = M.projection([30, 32, 34, 36, 38, 40], 35);
  assert.equal(p.remaining, 0);
});

test("projection refuses noisy or short data", () => {
  assert.equal(M.projection([20, 22, 21], 35), null);
  assert.equal(M.projection([30, 18, 33, 17, 31, 19, 32, 18], 35), null);
});

test("projection returns null remaining when the target is far away", () => {
  const p = M.projection([20, 20.2, 20.4, 20.6, 20.8, 21], 100);
  assert.equal(p.remaining, null);
});
