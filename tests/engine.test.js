const test = require("node:test");
const assert = require("node:assert/strict");
const { Session } = require("../js/core/engine.js");

// Types a string with a fixed gap between keys; returns the time of the last key.
function typeAll(s, text, gap = 200, t0 = 1000) {
  let t = t0;
  for (const ch of text) { s.press(ch, t); t += gap; }
  return t - gap;
}

test("a clean run finishes with full accuracy", () => {
  const s = new Session("hello world");
  const end = typeAll(s, "hello world");
  assert.ok(s.finished);
  const sum = s.summary();
  assert.equal(sum.accuracy, 100);
  assert.equal(sum.errors, 0);
  assert.equal(sum.chars, 11);
  assert.equal(sum.ms, end - 1000);
  assert.ok(Math.abs(sum.netWpm - (11 / 5) / ((end - 1000) / 60000)) < 1e-9);
});

test("a wrong key keeps the caret and counts one mistake", () => {
  const s = new Session("cat");
  s.press("c", 0);
  const r = s.press("x", 100);
  assert.equal(r.ok, false);
  assert.equal(s.pos, 1);
  assert.equal(s.wrong, 1);
  s.press("a", 200);
  s.press("t", 300);
  assert.ok(s.finished);
  assert.deepEqual(s.marks, [1, 2, 1]);   // "a" was typed correctly only after a mistake
  const sum = s.summary();
  assert.equal(sum.errors, 1);
  assert.equal(Math.round(sum.accuracy * 100) / 100, 75);   // 3 right out of 4 presses
  assert.deepEqual(s.confusions, [["a", "x"]]);
});

test("the caret never moves past a character until it is typed exactly right", () => {
  const s = new Session("aBc 1");
  s.press("a", 0);
  const wrongKeys = ["b", "A", "c", " ", "1", "B ", "Shift"];
  for (const key of wrongKeys) {
    assert.equal(s.press(key, 100).ok, false, `"${key}" should be wrong for "B"`);
    assert.equal(s.pos, 1, `the caret moved after "${key}"`);
  }
  assert.equal(s.press("B", 200).ok, true);
  assert.equal(s.pos, 2);
  assert.equal(s.press(" ", 300).ok, false);   // a space where "c" is expected
  assert.equal(s.pos, 2);
});

test("wrong keys in a row are counted per character and reset by a right key", () => {
  const s = new Session("ab");
  s.press("a", 0);
  assert.equal(s.press("x", 100).streak, 1);
  assert.equal(s.press("y", 150).streak, 2);
  assert.equal(s.press("z", 180).streak, 3);
  assert.equal(s.wrongStreak, 3);
  const ok = s.press("b", 300);
  assert.equal(ok.ok, true);
  assert.equal(ok.streak, 0);
  assert.equal(s.wrongStreak, 0);
});

test("a mistake on one character does not carry over to the next", () => {
  const s = new Session("abc");
  s.press("a", 0);
  s.press("x", 50);
  s.press("b", 100);
  assert.equal(s.press("y", 150).streak, 1);   // a fresh streak on "c"
});

test("keys after the end are ignored", () => {
  const s = new Session("ab");
  typeAll(s, "ab");
  assert.equal(s.press("c", 9999), null);
});

test("key samples hold the time since the last correct key and whether it was clean", () => {
  const s = new Session("abc");
  s.press("a", 0);
  s.press("x", 100);          // mistake on b
  s.press("b", 400);          // corrected, 400 ms after a
  s.press("c", 500);
  assert.equal(s.samples.length, 2);   // nothing for the very first key
  assert.deepEqual(s.samples[0], { ch: "b", prev: "a", ms: 400, ok: false });
  assert.deepEqual(s.samples[1], { ch: "c", prev: "b", ms: 100, ok: true });
});

test("samples are clamped so a pause cannot ruin a key's time", () => {
  const s = new Session("ab");
  s.press("a", 0);
  s.press("b", 60000);
  assert.equal(s.samples[0].ms, 2000);
});

test("a timed session ends at its limit and measures exactly that long", () => {
  const s = new Session("a".repeat(500), { limitMs: 10000 });
  s.press("a", 5000);
  s.tick(10000);
  assert.equal(s.finished, false);
  s.tick(15000);
  assert.ok(s.finished);
  assert.equal(s.summary().ms, 10000);
});

test("a key pressed after the time limit ends the session instead of counting", () => {
  const s = new Session("a".repeat(50), { limitMs: 1000 });
  s.press("a", 0);
  assert.equal(s.press("a", 1500), null);
  assert.ok(s.finished);
  assert.equal(s.correct, 1);
});

test("pausing cuts the paused time out of the clock", () => {
  const s = new Session("abcd");
  s.press("a", 0);
  s.pause(100);
  assert.equal(s.press("b", 200), null);    // ignored while paused
  s.resume(5100);                            // 5000 ms away
  s.press("b", 5200);
  s.press("c", 5300);
  s.press("d", 5400);
  assert.ok(s.finished);
  assert.equal(s.summary().ms, 400);         // 100 ms before the pause + 300 ms after it
});

test("live numbers do not spike in the first second", () => {
  const s = new Session("hello there");
  s.press("h", 0);
  s.press("e", 50);
  const live = s.live(50);
  assert.ok(live.wpm <= 2 / 5 / (1 / 60) + 1e-9);
  assert.equal(live.accuracy, 100);
});

test("an endless run keeps going past the end of its text and takes appended text", () => {
  const s = new Session("ab", { endless: true });
  s.press("a", 0);
  s.press("b", 100);
  assert.equal(s.finished, false, "reaching the end does not finish an endless run");
  assert.equal(s.press("c", 200), null, "nothing to type until text is appended");
  s.append(" cd");
  assert.equal(s.n, 5);
  assert.equal(s.marks.length, 5);
  assert.equal(s.hadError.length, 5);
  assert.equal(s.press(" ", 200).ok, true);
  assert.equal(s.press("x", 300).ok, false);
  assert.equal(s.press("c", 400).ok, true);
  assert.equal(s.press("d", 500).ok, true);
  assert.equal(s.finished, false);
  s.finish(600);
  assert.ok(s.finished);
  assert.equal(s.summary().chars, 5);
});

test("samples and mistakes can be taken a little at a time without losing the full lists", () => {
  const s = new Session("abcdef", { endless: true });
  s.press("a", 0); s.press("b", 100); s.press("x", 150); s.press("c", 200);
  assert.equal(s.pendingSamples(), 2);
  assert.deepEqual(s.takeSamples().map((x) => x.ch), ["b", "c"]);
  assert.deepEqual(s.takeConfusions(), [["c", "x"]]);
  assert.equal(s.pendingSamples(), 0);
  assert.deepEqual(s.takeSamples(), []);
  s.press("d", 300); s.press("e", 400);
  assert.deepEqual(s.takeSamples().map((x) => x.ch), ["d", "e"]);
  assert.equal(s.samples.length, 4, "the full list is kept for the summary");
  assert.deepEqual(s.takeConfusions(), []);
});

test("rolling speed follows the last 15 seconds, not the whole run", () => {
  const s = new Session("a".repeat(2000), { endless: true });
  let t = 0;
  for (let i = 0; i < 100; i++) { s.press("a", t); t += 1000; }          // 100 slow keys: 12 WPM
  for (let i = 0; i < 150; i++) { s.press("a", t); t += 100; }           // then 15 s of fast keys: 120 WPM
  const live = s.live(t);
  assert.ok(Math.abs(live.rollingWpm - 120) < 3, "rolling was " + live.rollingWpm);
  assert.ok(live.wpm < 40, "the whole-run speed was " + live.wpm);
});

test("rolling accuracy looks at the last hundred key presses", () => {
  const s = new Session("a".repeat(500), { endless: true });
  for (let i = 0; i < 50; i++) { s.press("x", i * 50); s.press("a", i * 50 + 20); }
  for (let i = 0; i < 100; i++) s.press("a", 5000 + i * 50);
  assert.equal(s.rollingAccuracy(100), 100);
  assert.ok(s.rollingAccuracy(200) < 100);
});

test("a long silence pauses the clock as of just after the last key", () => {
  const s = new Session("abcdef", { endless: true });
  s.press("a", 1000);
  s.press("b", 1200);
  assert.equal(s.pauseIfIdle(5000, 8000), false, "not idle yet");
  assert.equal(s.pauseIfIdle(20000, 8000), true);
  assert.equal(s.pausedAt, 3200);
  assert.equal(s.elapsed(20000), 2200, "only the time up to the pause counts");
  s.resume(20000);
  s.press("c", 20100);
  assert.equal(s.elapsed(20100), 2300, "the 16.8 s break is cut out: 2200 ms before it plus 100 ms after");
  assert.equal(new Session("ab").pauseIfIdle(99999, 1000), false, "a session that never started is never idle");
});

test("typing time adds up the gaps between keys and ignores long waits", () => {
  const s = new Session("a".repeat(50), { endless: true });
  s.press("a", 0);
  s.press("a", 200);         // 200 ms of typing
  s.press("a", 400);         // 200 ms
  s.press("a", 60400);       // a minute of doing nothing counts as at most 2 s
  s.press("a", 60500);       // 100 ms
  assert.equal(s.activeMs, 200 + 200 + 2000 + 100);
  s.finish(60500);
  assert.equal(s.summary().activeMs, 2500);
  assert.equal(s.summary().ms, 60500);
  assert.equal(new Session("abc").summary().activeMs, 0, "nothing typed, no typing time");
});

test("the letters mistyped most are found, worst first, once per character", () => {
  const s = new Session("red rat run rob tab", { endless: true });
  let t = 0;
  const type = (ch) => { s.press(ch, t); t += 150; };
  for (const ch of "red ") type(ch);
  type("e"); type("r"); type("a"); type("t"); type(" ");     // "rat": "e" is a wrong key for "r", so "r" has a mistake
  for (const ch of "run ") { if (ch === "r") type("x"); type(ch); }   // a mistake on "r" again
  for (const ch of "rob ") { if (ch === "r") { type("x"); type("y"); type("z"); } type(ch); }   // three wrong keys, still one mistake
  for (const ch of "tab") type(ch);
  assert.deepEqual(s.recentMistakes(0), ["r"]);
  assert.equal(s.hadError.filter(Boolean).length, 3, "three characters had mistakes");
  const s2 = new Session("aa bb cc dd", { endless: true });
  t = 0;
  for (const ch of "aa ") { s2.press(ch, t); t += 100; }
  s2.press("x", t); s2.press("b", t + 100); s2.press("b", t + 200); s2.press(" ", t + 300);
  s2.press("x", t + 400); s2.press("c", t + 500); s2.press("x", t + 600); s2.press("c", t + 700);
  assert.deepEqual(s2.recentMistakes(0), ["c", "b"], "c was missed twice, b once");
  assert.deepEqual(s2.recentMistakes(0, 1), ["c"]);
  assert.deepEqual(s2.recentMistakes(6), ["c"], "only mistakes since character 6 are counted");
  assert.deepEqual(new Session("abc").recentMistakes(0), []);
});

test("words typed counts finished words, not the one in progress", () => {
  const s = new Session("one two three ", { endless: true });
  assert.equal(s.wordsTyped(), 0);
  let t = 0;
  for (const ch of "one tw") { s.press(ch, t); t += 100; }
  assert.equal(s.wordsTyped(), 1, "'one' is done, 'two' is not");
  for (const ch of "o ") { s.press(ch, t); t += 100; }
  assert.equal(s.wordsTyped(), 2);
});

test("a couple of words are only a few seconds of typing time", () => {
  const s = new Session("hello there friend", { endless: true });
  let t = 0;
  for (const ch of "hello there") { s.press(ch, t); t += 180; }
  assert.ok(s.activeMs < 2500, "got " + s.activeMs);
});

test("an untouched session reports zeros", () => {
  const s = new Session("abc");
  const live = s.live(12345);
  assert.equal(live.ms, 0);
  assert.equal(live.wpm, 0);
  assert.equal(s.started, false);
});

test("the live typing time runs between keys, stops two seconds after the last key, and agrees with the saved time", () => {
  const s = new Session("a".repeat(50), { endless: true });
  assert.equal(s.liveActiveMs(0), 0, "nothing typed yet");
  s.press("a", 1000);
  assert.equal(s.liveActiveMs(1000), 0);
  s.press("a", 1300);                                        // 300 ms of typing
  assert.equal(s.activeMs, 300);
  assert.equal(s.liveActiveMs(1300), 300);
  assert.equal(s.liveActiveMs(1800), 800, "keeps counting while the next key is awaited");
  assert.equal(s.liveActiveMs(3300), 2300, "two seconds after the key it has reached its limit");
  assert.equal(s.liveActiveMs(60000), 2300, "and a long break adds nothing");
  s.press("a", 60000);                                       // the key after the break counts as two seconds, as the display showed
  assert.equal(s.activeMs, 2300);
  assert.equal(s.liveActiveMs(60000), 2300, "no jump when typing carries on");
  s.press("a", 60400);
  assert.equal(s.activeMs, 2700);
  assert.equal(s.liveActiveMs(60400 + 5000), 2700 + 2000);
});

test("the live typing time stops for a paused run and for a finished one", () => {
  const s = new Session("a".repeat(10), { endless: true });
  s.press("a", 0);
  s.press("a", 400);
  assert.equal(s.pauseIfIdle(20000, 8000), true);            // paused as of 2.4 s
  assert.equal(s.liveActiveMs(50000), 400 + 2000, "stopped 2 s after the last key: 400 ms typed, then at most 2 s of the gap");
  assert.equal(s.liveActiveMs(90000), s.liveActiveMs(50000), "nothing grows while paused");
  const t = new Session("ab");
  t.press("a", 0); t.press("b", 250);
  assert.ok(t.finished);
  assert.equal(t.liveActiveMs(99999), t.activeMs);
});
