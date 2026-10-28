const test = require("node:test");
const assert = require("node:assert/strict");
const layout = require("../js/core/layout.js");
const TG = require("../js/core/textgen.js");
const lessons = require("../js/core/lessons.js");
const { words, common } = require("../js/data/words.js");
const { sentences } = require("../js/data/sentences.js");
const { all: code, byLang } = require("../js/data/code.js");

const model = new TG.WordModel(words);

test("the word list is clean lowercase words with no duplicates", () => {
  assert.ok(words.length > 1200, `only ${words.length} words`);
  assert.equal(new Set(words).size, words.length);
  for (const w of words) assert.match(w, /^[a-z]+$/);
  assert.ok(common.length >= 300);
  assert.equal(common[0], "the");
});

test("every letter has plenty of words to practise with", () => {
  for (const ch of TG.LETTER_ORDER) {
    const n = words.filter((w) => w.length >= 3 && w.includes(ch)).length;
    assert.ok(n >= 10, `only ${n} words contain "${ch}"`);
  }
});

test("every sentence can be typed on the virtual keyboard", () => {
  assert.ok(sentences.length >= 40);
  for (const s of sentences) for (const ch of s) assert.ok(layout.isTypable(ch), `"${ch}" in: ${s}`);
});

test("the layout maps every printable ASCII character to a key and a finger", () => {
  for (let c = 32; c < 127; c++) {
    const ch = String.fromCharCode(c);
    const d = layout.describe(ch);
    assert.ok(d, `no key for "${ch}"`);
    assert.ok(d.key.finger, `no finger for "${ch}"`);
  }
});

test("capitals use Shift on the opposite hand", () => {
  assert.equal(layout.describe("A").shiftKey.code, "ShiftRight");
  assert.equal(layout.describe("J").shiftKey.code, "ShiftLeft");
  assert.equal(layout.describe("a").shiftKey, null);
  assert.deepEqual(layout.describe("!").fingers, ["lp", "rp"]);
  assert.equal(layout.describe(" ").key.finger, "th");
});

test("the home row keys sit under the right fingers", () => {
  const fingers = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"].map((c) => layout.FINGER_OF[c]);
  assert.deepEqual(fingers, ["lp", "lr", "lm", "li", "ri", "rm", "rr", "rp"]);
});

test("every key row adds up to the same width", () => {
  for (const row of layout.ROWS) assert.equal(row.reduce((a, k) => a + k.w, 0), 15);
});

test("the word model only uses the letters it is given", () => {
  const rng = TG.makeRng(7);
  const allowed = new Set("etaoin");
  for (let i = 0; i < 200; i++) {
    const w = model.word(rng, allowed, null);
    if (w) for (const ch of w) assert.ok(allowed.has(ch), `"${w}" has "${ch}"`);
  }
});

test("made-up words stay short and readable: no tripled letters, at most one double", () => {
  const rng = TG.makeRng(21);
  for (const letters of ["etaoin", "etaoinshrd", "etaoinshrdlcumwfgypbvkjxqz"]) {
    const allowed = new Set(letters);
    let made = 0;
    for (let i = 0; i < 300; i++) {
      const w = model.word(rng, allowed, i % 2 ? letters[i % letters.length] : null);
      if (!w) continue;
      made++;
      assert.ok(w.length >= 3 && w.length <= 7, `"${w}" has length ${w.length}`);
      assert.ok(!/(.)\1\1/.test(w), `"${w}" repeats a letter three times`);
      assert.ok((w.match(/(.)\1/g) || []).length <= 1, `"${w}" has more than one double letter`);
    }
    assert.ok(made > 250, `only ${made} of 300 words could be made from "${letters}"`);
  }
});

test("the word model steers towards the focus letter", () => {
  const rng = TG.makeRng(11);
  const allowed = new Set("etaoinshr");
  let hits = 0;
  for (let i = 0; i < 100; i++) if (model.word(rng, allowed, "h").includes("h")) hits++;
  assert.ok(hits >= 90, `only ${hits} of 100 contained the focus`);
});

test("adaptive words respect the alphabet, count and focus", () => {
  const rng = TG.makeRng(3);
  const included = [...TG.LETTER_ORDER.slice(0, 6)];
  const list = TG.adaptiveWords({ words, model, included, focus: "n", count: 30, mode: "mixed", rng });
  assert.equal(list.length, 30);
  for (const w of list) for (const ch of w) assert.ok(included.includes(ch), `"${w}"`);
  assert.ok(list.filter((w) => w.includes("n")).length >= 12);
  assert.equal(new Set(list).size, list.length > 25 ? new Set(list).size : list.length);
});

test("adaptive words with a bigger alphabet are mostly real and mostly unique", () => {
  const rng = TG.makeRng(5);
  const included = [...TG.LETTER_ORDER.slice(0, 16)];
  const list = TG.adaptiveWords({ words, model, included, focus: null, count: 40, mode: "real", rng });
  assert.equal(new Set(list).size, 40);
  const real = new Set(words);
  assert.ok(list.filter((w) => real.has(w)).length >= 35);
});

test("a word model can be told which letter every word must start with", () => {
  const rng = TG.makeRng(31);
  const allowed = new Set(TG.LETTER_ORDER.slice(0, 12));
  for (const first of ["r", "t", "h"]) {
    let made = 0;
    for (let i = 0; i < 60; i++) {
      const w = model.word(rng, allowed, first, 3, 7, first);
      if (!w) continue;
      made++;
      assert.equal(w[0], first, `"${w}" does not start with "${first}"`);
      for (const ch of w) assert.ok(allowed.has(ch));
    }
    assert.ok(made >= 50, `only ${made} words starting with "${first}"`);
  }
});

const included12 = [...TG.LETTER_ORDER.slice(0, 12)];   // e t a o i n s h r d l c
const startsWith = (w, l) => w[0] === l;
const hasInside = (w, l) => w.slice(1, -1).includes(l);

test("tricky-letter words: most start with the letter or have it in the middle", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const list = TG.weakWords({ words, model, included: included12, weak: ["r"], count: 15, mode: "mixed", rng: TG.makeRng(seed) });
    assert.equal(list.length, 15, `seed ${seed}: ${list.length} words`);
    const starts = list.filter((w) => startsWith(w, "r")).length;
    const middles = list.filter((w) => hasInside(w, "r")).length;
    assert.ok(starts >= 3, `seed ${seed}: only ${starts} words start with r: ${list.join(" ")}`);
    assert.ok(middles >= 3, `seed ${seed}: only ${middles} words have r in the middle: ${list.join(" ")}`);
    assert.ok(starts + middles >= 9, `seed ${seed}: ${starts + middles} of 15 aim at r`);
    for (const w of list) for (const ch of w) assert.ok(included12.includes(ch), `"${w}" uses a letter that is not unlocked`);
  }
});

test("tricky-letter words: more than one letter, the worst one most often, no repeats", () => {
  let first = 0;
  let second = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const list = TG.weakWords({ words, model, included: included12, weak: ["r", "h"], count: 15, rng: TG.makeRng(seed) });
    assert.equal(new Set(list).size, list.length, `seed ${seed} has repeated words: ${list.join(" ")}`);
    first += list.filter((w) => startsWith(w, "r") || hasInside(w, "r")).length;
    second += list.filter((w) => startsWith(w, "h") || hasInside(w, "h")).length;
  }
  assert.ok(first > second, `r (${first}) should come up more often than h (${second})`);
  assert.ok(second > 40 * 15 * 0.15, "h still gets its share: " + second);
});

test("tricky-letter words follow the real / made-up setting", () => {
  const real = new Set(words);
  const list = TG.weakWords({ words, model, included: included12, weak: ["r"], count: 15, mode: "real", rng: TG.makeRng(7) });
  assert.ok(list.filter((w) => real.has(w)).length >= 13, list.join(" "));
  const fake = TG.weakWords({ words, model, included: included12, weak: ["r"], count: 15, mode: "pseudo", rng: TG.makeRng(7) });
  assert.ok(fake.filter((w) => startsWith(w, "r") || hasInside(w, "r")).length >= 9, fake.join(" "));
});

test("tricky letters that are not unlocked, or not given, fall back to ordinary words", () => {
  const plain = TG.weakWords({ words, model, included: included12, weak: [], count: 15, rng: TG.makeRng(5) });
  assert.equal(plain.length, 15);
  const locked = TG.weakWords({ words, model, included: included12, weak: ["z", "q"], count: 15, rng: TG.makeRng(5) });
  assert.equal(locked.length, 15);
  for (const w of locked) for (const ch of w) assert.ok(included12.includes(ch));
});

test("with only a few letters unlocked there are still enough words, and the same seed gives the same words", () => {
  const six = [...TG.LETTER_ORDER.slice(0, 6)];
  const a = TG.weakWords({ words, model, included: six, weak: ["n"], count: 15, rng: TG.makeRng(9) });
  const b = TG.weakWords({ words, model, included: six, weak: ["n"], count: 15, rng: TG.makeRng(9) });
  assert.deepEqual(a, b);
  assert.equal(a.length, 15);
  assert.ok(a.filter((w) => startsWith(w, "n") || hasInside(w, "n")).length >= 7, a.join(" "));
});

test("generation is repeatable for the same seed", () => {
  const a = TG.adaptiveWords({ words, model, included: [..."etaoinsh"], focus: "s", count: 20, mode: "mixed", rng: TG.makeRng(42) });
  const b = TG.adaptiveWords({ words, model, included: [..."etaoinsh"], focus: "s", count: 20, mode: "mixed", rng: TG.makeRng(42) });
  assert.deepEqual(a, b);
});

test("decorate adds capitals and punctuation that can be typed", () => {
  const rng = TG.makeRng(9);
  const base = TG.commonWords(common, 60, rng);
  const both = TG.decorate(base, { capitals: true, punctuation: true }, rng).join(" ");
  assert.match(both, /^[A-Z]/);
  assert.match(both, /[.,?!;]/);
  assert.ok(both.endsWith("."));
  for (const ch of both) assert.ok(layout.isTypable(ch));
  assert.deepEqual(TG.decorate(["a", "b"], {}, rng), ["a", "b"]);
});

test("numbers replace some words with digits", () => {
  const rng = TG.makeRng(2);
  const list = TG.withNumbers(TG.commonWords(common, 200, rng), rng);
  assert.ok(list.some((w) => /^\d+$/.test(w)));
});

test("common words never repeat back to back and respect the length limit", () => {
  const list = TG.commonWords(common, 100, TG.makeRng(1), { maxLen: 6 });
  for (let i = 1; i < list.length; i++) assert.notEqual(list[i], list[i - 1]);
  assert.ok(list.every((w) => w.length <= 6));
});

test("sentences are picked without repeats until the bank runs out", () => {
  const list = TG.pickSentences(sentences, 10, TG.makeRng(4));
  assert.equal(new Set(list).size, 10);
});

test("code snippets are one-line, tidy and typable", () => {
  assert.ok(code.length >= 50, `only ${code.length} snippets`);
  for (const lang of ["javascript", "python", "html", "css", "sql", "shell"]) assert.ok(byLang[lang].length >= 8, lang);
  for (const s of code) {
    assert.ok(s.length >= 15 && s.length <= 80, `"${s}" has length ${s.length}`);
    assert.equal(s, s.trim(), `"${s}" has spaces at the ends`);
    assert.ok(!s.includes("  "), `"${s}" has a double space`);
    for (const ch of s) assert.ok(layout.isTypable(ch), `"${ch}" in: ${s}`);
  }
});

test("the code snippets use every symbol programmers need", () => {
  const used = new Set(code.join(""));
  for (const ch of "{}[]()<>=+-*/\\|~`'\";:,.!?@#$%&^_") assert.ok(used.has(ch), `no snippet uses "${ch}"`);
  assert.ok(/[A-Z]/.test(code.join("")) && /[0-9]/.test(code.join("")), "needs capitals and digits");
});

test("every printable key on the keyboard is taught by some lesson", () => {
  const taught = lessons.introduced(lessons.LESSONS.length).toLowerCase();
  for (let c = 33; c < 127; c++) {
    const ch = String.fromCharCode(c);
    assert.ok(taught.includes(ch.toLowerCase()), `no lesson teaches "${ch}"`);
  }
  assert.ok(lessons.LESSONS.some((l) => l.capitals), "no lesson teaches capitals");
});

test("every course lesson produces text that can be typed and uses only taught keys", () => {
  for (const lesson of lessons.LESSONS) {
    for (let seed = 1; seed <= 5; seed++) {
      const text = lessons.lessonText(lesson, { words, sentences, code, rng: TG.makeRng(seed) });
      assert.ok(text.length > 40, `lesson ${lesson.id} text is short: "${text}"`);
      assert.ok(!text.startsWith(" ") && !text.endsWith(" ") && !text.includes("  "));
      const taught = new Set(lessons.introduced(lesson.id) + " ");
      for (const ch of text) {
        assert.ok(layout.isTypable(ch), `lesson ${lesson.id}: "${ch}"`);
        if (!lesson.sentences && !lesson.capitals && !lesson.code) {
          assert.ok(taught.has(ch.toLowerCase()) || taught.has(ch), `lesson ${lesson.id} uses "${ch}" before it is taught: ${text}`);
        }
      }
    }
  }
});

test("each lesson text practises every new key at least three times", () => {
  for (const lesson of lessons.LESSONS.filter((l) => l.keys)) {
    for (let seed = 1; seed <= 25; seed++) {
      const text = lessons.lessonText(lesson, { words, sentences, code, rng: TG.makeRng(seed) });
      for (const k of lesson.keys) {
        const n = text.split(k).length - 1;
        assert.ok(n >= 3, `lesson ${lesson.id}, seed ${seed}: "${k}" appears ${n} times`);
      }
    }
  }
});

test("lesson grading: pass needs speed and 90% accuracy, stars reward accuracy", () => {
  const l = { minWpm: 20 };
  assert.deepEqual(lessons.grade(l, { accuracy: 89, netWpm: 40 }), { passed: false, stars: 0 });
  assert.deepEqual(lessons.grade(l, { accuracy: 99, netWpm: 19 }), { passed: false, stars: 0 });
  assert.deepEqual(lessons.grade(l, { accuracy: 91, netWpm: 20 }), { passed: true, stars: 1 });
  assert.deepEqual(lessons.grade(l, { accuracy: 96, netWpm: 22 }), { passed: true, stars: 2 });
  assert.deepEqual(lessons.grade(l, { accuracy: 98.5, netWpm: 27 }), { passed: true, stars: 3 });
});
