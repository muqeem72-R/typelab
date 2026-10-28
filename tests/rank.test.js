const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/core/rank.js");

const T0 = Date.UTC(2026, 9, 28, 12);
const sess = (wpm, extra = {}) => ({ ts: T0, kind: "test", mode: "time", label: "30 s", wpm, raw: wpm, acc: 96, errors: 1, ms: 30000, chars: 150, cons: 70, ...extra });
const course = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { stars: 1, wpm: 20, acc: 95, tries: 1 }]));

test("a session qualifies only when it is long, accurate and on comparable text", () => {
  assert.ok(R.qualifies(sess(40)));
  assert.ok(!R.qualifies(sess(40, { ms: 19000 })));
  assert.ok(!R.qualifies(sess(40, { chars: 59 })));
  assert.ok(!R.qualifies(sess(40, { acc: 91.9 })));
  assert.ok(!R.qualifies(sess(300)), "impossible speeds never count");
  assert.ok(!R.qualifies(sess(40, { kind: "course", mode: "course" })));
  assert.ok(!R.qualifies(sess(40, { mode: "code" })), "code is much slower, so it is not ranked");
  assert.ok(R.qualifies(sess(40, { mode: "words" })));
  assert.ok(R.qualifies(sess(40, { mode: "sentences" })));
});

test("adaptive practice counts only once 18 letters are in play", () => {
  assert.ok(!R.qualifies(sess(60, { kind: "practice", mode: "adaptive", letters: 8 })));
  assert.ok(!R.qualifies(sess(60, { kind: "practice", mode: "adaptive" })));
  assert.ok(R.qualifies(sess(60, { kind: "practice", mode: "adaptive", letters: 18 })));
});

test("older sessions without a mode are read from their kind", () => {
  assert.equal(R.modeOf({ kind: "test" }), "time");
  assert.equal(R.modeOf({ kind: "practice" }), "adaptive");
  assert.equal(R.modeOf({ kind: "course" }), "course");
  assert.equal(R.modeOf({ kind: "test", mode: "code" }), "code");
});

test("the score is the average of the best three qualifying sessions", () => {
  assert.equal(R.score([]), 0);
  assert.equal(R.score([sess(40)]), 40);
  assert.equal(R.score([sess(40), sess(50)]), 45);
  assert.equal(R.score([sess(30), sess(40), sess(50), sess(60), sess(20)]), 50);
  assert.equal(R.score([sess(90, { acc: 80 }), sess(40)]), 40, "a sloppy run does not count");
  assert.equal(R.bestWpm([sess(31.26), sess(45.04), sess(99, { acc: 50 })]), 45);
  assert.equal(R.averageAccuracy([sess(40, { acc: 95 }), sess(40, { acc: 99 })]), 97);
});

test("the weekly best only looks at this week", () => {
  const thisWeek = R.weekId(T0);
  const lastWeek = T0 - 8 * 86400000;
  assert.equal(R.weeklyBest([sess(50), sess(70, { ts: lastWeek })], thisWeek), 50);
  assert.equal(R.weeklyBest([sess(70, { ts: lastWeek })], thisWeek), 0);
});

test("speed tiers climb with the score", () => {
  assert.equal(R.tierFor(0).id, "beginner");
  assert.equal(R.tierFor(19.9).id, "beginner");
  assert.equal(R.tierFor(20).id, "learner");
  assert.equal(R.tierFor(44).id, "skilled");
  assert.equal(R.tierFor(64.9).id, "fast");
  assert.equal(R.tierFor(120).id, "legend");
  assert.deepEqual([R.nextTier(46).tier.id, R.nextTier(46).need], ["fast", 4]);
  assert.equal(R.nextTier(100), null);
});

test("lesson run counts the lessons passed from the start without a gap", () => {
  assert.equal(R.lessonRun({}), 0);
  assert.equal(R.lessonRun(course(7)), 7);
  const gap = course(10);
  delete gap[4];
  assert.equal(R.lessonRun(gap), 3);
  assert.equal(R.lessonRun(course(24)), 24);
  assert.equal(R.lessonRun({ 1: { stars: 0 } }), 0);
});

test("the leaderboard numbers are summarised, not the sessions", () => {
  const state = { sessions: [sess(40), sess(50), sess(60), sess(30, { mode: "course", kind: "course" })], course: course(18) };
  const s = R.syncStats(state, T0);
  assert.deepEqual(s, { score: 50, best: 60, acc: 96, sessions: 4, lessons: 18, wkId: "2026-W44", wk: 60 });
});

test("achievements switch on from the saved data", () => {
  const base = { sessions: [], course: {}, adaptive: { unlocked: 6 } };
  const ids = (state, streak) => R.achievements(state, streak).filter((a) => a.earned).map((a) => a.id);
  assert.deepEqual(ids(base, 0), []);
  assert.deepEqual(ids({ ...base, sessions: [sess(52)] }, 0), ["first", "speed30", "speed40", "speed50"]);
  assert.ok(ids(base, 8).includes("streak7"));
  assert.ok(!ids(base, 2).includes("streak3"));
  assert.ok(ids({ ...base, sessions: [sess(20, { ms: 600000 })] }, 0).includes("marathon"));
  assert.ok(ids({ ...base, sessions: [sess(20, { chars: 120, acc: 99.5 })] }, 0).includes("sharp"));
  assert.ok(ids({ ...base, sessions: [sess(26, { mode: "code", acc: 96 })] }, 0).includes("coder"));
  assert.ok(ids({ ...base, adaptive: { unlocked: 26 } }, 0).includes("alphabet"));
  const done = ids({ ...base, course: course(24) }, 0);
  assert.ok(done.includes("core") && done.includes("programmer"));
  assert.ok(!ids({ ...base, course: course(18) }, 0).includes("programmer"));
  assert.equal(new Set(R.ACHIEVEMENTS.map((a) => a.id)).size, R.ACHIEVEMENTS.length);
});
