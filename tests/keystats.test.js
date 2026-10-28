const test = require("node:test");
const assert = require("node:assert/strict");
const KS = require("../js/core/keystats.js");
const M = require("../js/core/metrics.js");
const { LETTER_ORDER } = require("../js/core/textgen.js");

const order = [...LETTER_ORDER];
const fresh = () => ({ keys: {}, pairs: {}, confusions: {} });

// Gives a key n samples at a fixed speed, all clean.
function feed(state, ch, ms, n = 10, ok = true) {
  KS.update(state, Array.from({ length: n }, () => ({ ch, prev: null, ms, ok })));
}

test("update keeps a smoothed time, a best time and a hit history", () => {
  const st = fresh();
  KS.update(st, [{ ch: "E", prev: "t", ms: 300, ok: true }, { ch: "e", prev: "t", ms: 200, ok: false }]);
  const k = st.keys.e;
  assert.equal(k.n, 2);
  assert.equal(k.best, 300);   // only clean samples set the best time
  assert.equal(k.hist, "10");
  assert.ok(k.time < 300 && k.time > 200);
  assert.equal(st.pairs.te.n, 2);
  assert.equal(st.pairs.te.miss, 1);
});

test("confidence is 1 exactly at the target speed and needs enough samples", () => {
  const st = fresh();
  feed(st, "e", M.msFromSpeed(35), 2);
  assert.equal(KS.confidence(st.keys.e, 35), 0);
  feed(st, "e", M.msFromSpeed(35), 5);
  assert.ok(Math.abs(KS.confidence(st.keys.e, 35) - 1) < 1e-9);
  assert.ok(KS.confidence(st.keys.e, 70) < 1);
  assert.equal(KS.confidence(undefined, 35), 0);
});

test("accuracy needs a few presses and reads the recent history", () => {
  const st = fresh();
  feed(st, "a", 200, 3);
  assert.equal(KS.accuracy(st.keys.a), null);
  feed(st, "a", 200, 6, false);
  assert.ok(Math.abs(KS.accuracy(st.keys.a) - 3 / 9) < 1e-9);
});

test("the plan starts with six letters and focuses the first untried one", () => {
  const p = KS.plan({}, order, 6, 35);
  assert.equal(p.count, 6);
  assert.deepEqual(p.included, order.slice(0, 6));
  assert.equal(p.focus, order[0]);   // nothing is done yet; ties go to the earliest letter
  assert.equal(p.rows.filter((r) => r.state === "locked").length, 20);
  assert.deepEqual(p.unlockedNow, []);
});

test("a new letter unlocks only when every letter in play is fast and accurate", () => {
  const st = fresh();
  const speedy = M.msFromSpeed(40);
  for (const ch of order.slice(0, 5)) feed(st, ch, speedy);
  let p = KS.plan(st.keys, order, 6, 35);
  assert.equal(p.count, 6);                       // the sixth letter has no data yet
  assert.equal(p.focus, order[5]);
  feed(st, order[5], speedy);
  p = KS.plan(st.keys, order, 6, 35);
  assert.equal(p.count, 7);                       // all six are done, so the seventh unlocks
  assert.deepEqual(p.unlockedNow, [order[6]]);
  assert.equal(p.focus, order[6]);                // and it becomes the focus
  assert.equal(p.rows[6].state, "focus");
  assert.equal(p.rows[0].state, "done");
});

test("a slow or sloppy letter blocks unlocking", () => {
  const st = fresh();
  const speedy = M.msFromSpeed(40);
  for (const ch of order.slice(0, 6)) feed(st, ch, speedy);
  feed(st, order[2], speedy, 10, false);          // now a lot of misses on one key
  let p = KS.plan(st.keys, order, 6, 35);
  assert.equal(p.count, 6);
  assert.equal(p.focus, order[2]);
  st.keys[order[3]].time = M.msFromSpeed(20);     // another one is slow
  p = KS.plan(st.keys, order, 6, 35);
  assert.equal(p.count, 6);
});

test("unlocked letters never go back, even if speed drops", () => {
  const st = fresh();
  for (const ch of order.slice(0, 9)) feed(st, ch, M.msFromSpeed(10));
  const p = KS.plan(st.keys, order, 9, 35);
  assert.equal(p.count, 9);
});

test("the focus is the weakest letter in play", () => {
  const st = fresh();
  feed(st, order[0], M.msFromSpeed(40));
  feed(st, order[1], M.msFromSpeed(30));
  feed(st, order[2], M.msFromSpeed(20));
  feed(st, order[3], M.msFromSpeed(34));
  feed(st, order[4], M.msFromSpeed(40));
  feed(st, order[5], M.msFromSpeed(40));
  const p = KS.plan(st.keys, order, 6, 35);
  assert.equal(p.focus, order[2]);
});

test("confusions are counted and pruned to a bounded size", () => {
  const st = fresh();
  KS.update(st, [], [["a", "s"], ["a", "s"], ["e", "r"]]);
  assert.equal(st.confusions["a>s"], 2);
  assert.equal(st.confusions["e>r"], 1);
  for (let i = 0; i < 300; i++) KS.update(st, [], [["x", String.fromCharCode(33 + (i % 90)) + i]]);
  assert.ok(Object.keys(st.confusions).length <= 240);
});
