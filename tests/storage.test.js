const test = require("node:test");
const assert = require("node:assert/strict");

// Node has no localStorage, so a small stand-in keeps what the store saves, like a browser would.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
};
const store = require("../js/core/storage.js");

const summary = (wpm, acc = 97, ms = 60000) => ({ netWpm: wpm, rawWpm: wpm + 2, accuracy: acc, errors: 2, chars: 100, ms, consistency: 70 });

test("defaults are sane and the first load works without storage", () => {
  store.reset();
  const st = store.load();
  assert.equal(st.settings.targetWpm, 35);
  assert.equal(st.adaptive.unlocked, 6);
  assert.deepEqual(st.sessions, []);
});

test("recording a session updates history, day totals and bests", () => {
  store.reset();
  const a = store.recordSession({ kind: "test", label: "30 s", bestKey: "time:30", summary: summary(40) });
  assert.equal(a.isBest, false);   // the first result is not announced as a record
  const b = store.recordSession({ kind: "test", label: "30 s", bestKey: "time:30", summary: summary(45.26) });
  assert.equal(b.isBest, true);
  const c = store.recordSession({ kind: "test", label: "30 s", bestKey: "time:30", summary: summary(30) });
  assert.equal(c.isBest, false);
  const st = store.load();
  assert.equal(st.sessions.length, 3);
  assert.equal(st.bests["time:30"].wpm, 45.3);
  const day = st.days[store.dayKey(new Date())];
  assert.equal(day.n, 3);
  assert.equal(day.ms, 180000);
  assert.equal(store.todayMs(), 180000);
  assert.equal(store.streak(), 0, "three minutes of typing is not yet a streak day");
});

test("the history is capped", () => {
  store.reset();
  for (let i = 0; i < 1010; i++) store.recordSession({ kind: "practice", summary: summary(30) });
  assert.equal(store.load().sessions.length, 1000);
});

test("streak counts back through consecutive days only", () => {
  store.reset();
  const st = store.load();
  const d = new Date();
  for (const back of [0, 1, 2, 4]) {
    const x = new Date(d);
    x.setDate(x.getDate() - back);
    st.days[store.dayKey(x)] = { n: 1, ms: 400000, chars: 10, act: 310000 };
  }
  assert.equal(store.streak(), 3);
});

const DAY = 86400000;
const withDays = (spec) => {
  store.reset();
  const st = store.load();
  for (const [back, act] of Object.entries(spec)) {
    const x = new Date(Date.now() - back * DAY);
    st.days[store.dayKey(x)] = { n: 1, ms: act, chars: 100, act };
  }
  return st;
};

test("a streak day needs five minutes of real typing, not a visit or a few words", () => {
  assert.equal(store.STREAK_MS, 5 * 60 * 1000);
  withDays({ 0: 4000 });                                 // a visit and a couple of words
  assert.equal(store.streak(), 0);
  withDays({ 0: store.STREAK_MS - 1 });                  // one second short
  assert.equal(store.streak(), 0);
  withDays({ 0: store.STREAK_MS });                      // exactly five minutes
  assert.equal(store.streak(), 1);
  withDays({ 0: 40 * 60000 });                           // more than that is good too, and still counts as one day
  assert.equal(store.streak(), 1);
  withDays({ 0: 6 * 60000, 1: 30000, 2: 9 * 60000 });    // yesterday was only a short visit: the streak is broken
  assert.equal(store.streak(), 1);
});

test("a streak that has not been kept up today is still alive until the day ends", () => {
  withDays({ 1: 6 * 60000, 2: 7 * 60000, 3: 8 * 60000 });   // nothing typed yet today
  assert.equal(store.streak(), 3, "today is short of five minutes, but yesterday's streak is not lost yet");
  assert.equal(store.todayActiveMs(), 0);
  withDays({ 0: 2 * 60000, 1: 6 * 60000, 2: 7 * 60000 });    // two minutes so far today
  assert.equal(store.streak(), 2);
});

test("a run that is still going counts towards today before it is saved", () => {
  withDays({ 1: 6 * 60000, 2: 7 * 60000 });
  assert.equal(store.streak(), 2);
  assert.equal(store.streak(3 * 60000), 2, "three minutes into today's run is not enough yet");
  assert.equal(store.streak(store.STREAK_MS), 3, "the fifth minute makes today a streak day");
  assert.equal(store.streak(0), 2);
});

test("typing time is added up across the day, and counts the typing, not the waiting", () => {
  store.reset();
  const done = (ms, activeMs) => store.recordSession({ kind: "test", summary: { ...summary(50), ms, activeMs } });
  done(180000, 170000);                                   // three minutes in the first session
  assert.equal(store.streak(), 0);
  assert.equal(store.todayActiveMs(), 170000);
  done(600000, 90000);                                    // ten minutes on the clock, but mostly waiting
  assert.equal(store.todayActiveMs(), 260000);
  assert.equal(store.streak(), 0, "waiting around does not count");
  done(60000, 59000);
  assert.equal(store.todayActiveMs(), 319000);
  assert.equal(store.streak(), 1, "together the sessions made five minutes of typing");
  assert.equal(store.todayMs(), 840000, "the total session time is kept as well");
});

test("days saved before typing time was tracked still count by their session time", () => {
  store.reset();
  const st = store.load();
  st.days[store.dayKey(new Date())] = { n: 2, ms: 400000, chars: 300 };
  assert.equal(store.activeOf(st.days[store.dayKey(new Date())]), 400000);
  assert.equal(store.streak(), 1);
  store.recordSession({ kind: "test", summary: { ...summary(40), ms: 10000, activeMs: 9000 } });
  assert.equal(store.todayActiveMs(), 409000, "the old time is kept when new typing is added");
  assert.equal(store.activeOf(undefined), 0);
});

test("the typing time of a day survives saving and loading", () => {
  const d = store.clean({ v: 1, days: { "2026-10-28": { n: 3, ms: 900000, chars: 50, act: 310000 }, "2026-10-27": { n: 1, ms: 5, chars: 5 } } });
  assert.equal(d.days["2026-10-28"].act, 310000);
  assert.equal(d.days["2026-10-27"].act, undefined);
});

test("export then import gives back the same data", () => {
  store.reset();
  store.recordSession({ kind: "practice", label: "x", summary: summary(33) });
  store.load().keys.e = { time: 250, n: 12, best: 200, hist: "1110111" };
  const text = store.exportJson();
  store.reset();
  store.importJson(text);
  assert.equal(store.load().sessions.length, 1);
  assert.equal(store.load().keys.e.n, 12);
});

test("import rejects files that are not TypeLab backups", () => {
  assert.throws(() => store.importJson("[1,2,3]"));
  assert.throws(() => store.importJson("{\"v\":99}"));
  assert.throws(() => store.importJson("not json"));
});

test("clean throws away junk and clamps wild values", () => {
  const d = store.clean({
    v: 1,
    settings: { targetWpm: 9999, wordCount: "lots", dailyGoalMin: -5, sound: "yes", volume: 900, handTone: "purple", mode: "x", testLang: "cobol", testCode: 4 },
    adaptive: { unlocked: 999 },
    keys: { e: { n: 5, time: 200, hist: "10x1<script>" }, toolong: { n: 1 }, q: "nope" },
    sessions: [{ ts: 1, kind: "practice", wpm: 30 }, { ts: "bad" }, null],
    days: { "2026-01-01": { n: 1 }, "<b>": { n: 1 } },
    course: { 3: { stars: 9 }, x: { stars: 1 } },
    pairs: { th: { n: 4, miss: 99 }, "t<": { n: 1 } },
    confusions: { "a>s": 3, "bad": 2 },
  });
  assert.equal(d.settings.targetWpm, 150);
  assert.equal(d.settings.wordCount, undefined, "settings that no longer exist are dropped");
  assert.equal(d.settings.dailyGoalMin, undefined, "the old daily goal setting is gone");
  assert.equal(d.settings.sound, true);        // not a boolean, so the default stays
  assert.equal(d.settings.volume, 100);
  assert.equal(d.settings.handTone, "medium");
  assert.equal(d.settings.mode, "adaptive");
  assert.equal(d.settings.testLang, "all");
  assert.equal(d.settings.testCode, 3);
  assert.equal(d.adaptive.unlocked, 26);
  assert.deepEqual(Object.keys(d.keys), ["e"]);
  assert.equal(d.keys.e.hist, "101");
  assert.equal(d.sessions.length, 1);
  assert.deepEqual(Object.keys(d.days), ["2026-01-01"]);
  assert.equal(d.course[3].stars, 3);
  assert.deepEqual(Object.keys(d.course), ["3"]);
  assert.equal(d.pairs.th.miss, 4);
  assert.deepEqual(Object.keys(d.pairs), ["th"]);
  assert.deepEqual(Object.keys(d.confusions), ["a>s"]);
});

test("sessions keep their mode and letter count, and course sessions are marked as course", () => {
  store.reset();
  store.recordSession({ kind: "practice", mode: "adaptive", letters: 19, summary: summary(50) });
  store.recordSession({ kind: "test", mode: "code", summary: summary(30) });
  store.recordSession({ kind: "course", label: "Lesson 1", summary: summary(30) });
  store.recordSession({ kind: "test", summary: summary(30) });
  const s = store.load().sessions;
  assert.deepEqual(s.map((x) => x.mode), ["adaptive", "code", "course", "time"]);
  assert.equal(s[0].letters, 19);
  assert.equal(s[1].letters, undefined);
  const back = store.clean(JSON.parse(JSON.stringify(store.load())));
  assert.deepEqual(back.sessions.map((x) => x.mode), ["adaptive", "code", "course", "time"]);
  assert.equal(back.sessions[0].letters, 19);
});

test("each profile has its own data and the guest keeps its own", () => {
  store.use("");
  store.reset();
  store.recordSession({ kind: "test", summary: summary(30) });
  store.use("abc123abc123abc1");
  assert.equal(store.load().sessions.length, 0, "a new profile starts empty");
  store.recordSession({ kind: "test", summary: summary(44) });
  store.use("");
  assert.equal(store.load().sessions.length, 1);
  assert.equal(store.load().sessions[0].wpm, 30);
  store.use("abc123abc123abc1");
  assert.equal(store.load().sessions[0].wpm, 44);
  assert.equal(store.dataKey(), "typeLab.data.abc123abc123abc1");
  store.use("");
  assert.equal(store.dataKey(), "typeLab.data");
});

test("tours are remembered per profile, once finished they stay finished, and they can be reset", () => {
  store.use("");
  store.reset();
  assert.equal(store.tourDone("practice"), false);
  store.markTour("practice");
  assert.equal(store.tourDone("practice"), true);
  assert.equal(store.tourDone("course"), false);
  store.markTour("not-a-tour");
  assert.deepEqual(Object.keys(store.load().tours), ["practice"]);
  store.use("feedfeedfeedfeed");
  assert.equal(store.tourDone("practice"), false, "another profile has not seen it");
  store.use("");
  assert.equal(store.tourDone("practice"), true);
  store.resetTours();
  assert.equal(store.tourDone("practice"), false);
});

test("certificates, badges and tours are validated when loaded", () => {
  const d = store.clean({
    v: 1,
    certs: { core: { code: "abc.def_-1", ts: 5 }, programmer: { code: "<script>", ts: 5 }, gold: { code: "x", ts: 1 } },
    badges: { first: 10, "BAD ID": 5, speed30: "yes" },
    tours: { nav: 1, home: "x", hacker: 3 },
  });
  assert.deepEqual(Object.keys(d.certs), ["core"]);
  assert.deepEqual(d.badges, { first: 10 });
  assert.deepEqual(d.tours, { nav: 1 });
});

test("clean copes with null and non-objects", () => {
  assert.equal(store.clean(null).settings.targetWpm, 35);
  assert.equal(store.clean("hello").adaptive.unlocked, 6);
});
