/* TypeLab text generation: seeded randomness, a small letter-chain model that makes
   pronounceable pseudo-words, and the helpers that turn word lists into practice text.
   Every function takes its word list and random source as arguments, so tests are repeatable. */
(function (root) {
  "use strict";

  // General English letter frequency, most common first. Adaptive practice unlocks in this order.
  const LETTER_ORDER = "etaoinshrdlcumwfgypbvkjxqz";

  // mulberry32: a tiny seeded generator, good enough for choosing words.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randomSeed = () => (Math.random() * 4294967296) >>> 0;
  const pick = (list, rng) => list[Math.floor(rng() * list.length)];

  // A letter-chain model: it learns which letter tends to follow the previous two,
  // then walks that chain using only the letters it is allowed to use.
  class WordModel {
    constructor(words, order = 3) {
      this.order = order;
      this.pad = "^".repeat(order - 1);
      this.table = new Map();
      for (const w of words) {
        const s = this.pad + w + "$";
        for (let i = order - 1; i < s.length; i++) {
          const ctx = s.slice(i - order + 1, i);
          let row = this.table.get(ctx);
          if (!row) this.table.set(ctx, (row = new Map()));
          row.set(s[i], (row.get(s[i]) || 0) + 1);
        }
      }
    }

    // `allowed` is a Set of letters. When `focus` is given the word is steered towards that
    // letter, and a word without it is only returned if no better word turns up.
    // `first`, when given, is the letter the word must start with.
    word(rng, allowed, focus, minLen = 3, maxLen = 7, first = null) {
      let fallback = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const w = this.walk(rng, allowed, focus, minLen, maxLen, first);
        if (!w) continue;
        if (!focus || w.includes(focus)) return w;
        if (!fallback) fallback = w;
      }
      return fallback;
    }

    // Walks the chain one letter at a time. To keep the words readable it never repeats a
    // letter three times, allows at most one doubled letter, and ends words early once they
    // are four letters long.
    walk(rng, allowed, focus, minLen, maxLen, first) {
      let ctx = this.pad;
      let out = "";
      let doubles = 0;
      for (;;) {
        const row = this.table.get(ctx);
        if (!row) return null;
        const last = out[out.length - 1];
        const options = [];
        let total = 0;
        for (const [ch, count] of row) {
          let weight = count;
          if (ch === "$") {
            if (out.length < minLen) continue;
            if (out.length >= 4) weight *= 3;
          } else {
            if (!allowed.has(ch) || out.length >= maxLen) continue;
            if (first && out.length === 0 && ch !== first) continue;
            if (ch === last && (doubles >= 1 || out[out.length - 2] === ch)) continue;
            if (ch === focus) weight *= 4;
          }
          options.push([ch, weight]);
          total += weight;
        }
        if (!options.length) return null;
        let r = rng() * total;
        let chosen = options[options.length - 1][0];
        for (const [ch, weight] of options) {
          r -= weight;
          if (r < 0) { chosen = ch; break; }
        }
        if (chosen === "$") return out;
        if (chosen === last) doubles++;
        out += chosen;
        ctx = (ctx + chosen).slice(-(this.order - 1));
      }
    }
  }

  // Words for adaptive practice: only the letters in play, leaning on the focus letter.
  // mode "real" prefers dictionary words, "pseudo" prefers made-up words, "mixed" does both.
  // A real word is used again only when nothing fresh can be made.
  function adaptiveWords({ words, model, included, focus, count, mode = "mixed", rng }) {
    const allowed = new Set(included);
    const pool = words.filter((w) => w.length >= 3 && w.length <= 10 && [...w].every((c) => allowed.has(c)));
    const withFocus = focus ? pool.filter((w) => w.includes(focus)) : [];
    const used = new Set();
    const out = [];
    for (let i = 0; i < count; i++) {
      let w = null;
      const wantReal = mode === "real" || (mode === "mixed" && rng() < 0.5);
      if (wantReal && pool.length) {
        const source = withFocus.length && rng() < 0.6 ? withFocus : pool;
        for (let tries = 0; tries < 8 && !w; tries++) {
          const c = pick(source, rng);
          if (!used.has(c)) w = c;
        }
      }
      for (let tries = 0; tries < 8 && !w; tries++) {
        const c = model.word(rng, allowed, rng() < 0.7 ? focus : null);
        if (c && !used.has(c)) w = c;
      }
      if (!w && pool.length) w = pick(pool, rng);
      if (!w) w = pick(included, rng).repeat(3);
      used.add(w);
      out.push(w);
    }
    return out;
  }

  // Words aimed at the letters a player keeps getting wrong (`weak`, the worst first). Of every ten words,
  // about three or four start with one of those letters, three or four have one somewhere in the middle,
  // and the rest are ordinary adaptive words. The worst letter is picked most often. Only letters that are
  // already unlocked are used, and a letter with no suitable words is simply skipped.
  const START_SHARE = 0.35;
  const MIDDLE_SHARE = 0.35;

  function weakWords({ words, model, included, weak, focus = null, count, mode = "mixed", rng }) {
    const allowed = new Set(included);
    const letters = weak.filter((l) => allowed.has(l));
    const general = (n) => adaptiveWords({ words, model, included, focus, count: n, mode, rng });
    if (!letters.length) return general(count);

    const pool = words.filter((w) => w.length >= 3 && w.length <= 10 && [...w].every((c) => allowed.has(c)));
    const used = new Set();
    const out = [];
    const total = letters.length * (letters.length + 1) / 2;
    const pickLetter = () => {
      let r = rng() * total;
      for (let i = 0; i < letters.length; i++) { r -= letters.length - i; if (r < 0) return letters[i]; }
      return letters[0];
    };
    const realWord = (list) => {
      for (let t = 0; t < 8; t++) { const c = pick(list, rng); if (!used.has(c)) return c; }
      return null;
    };
    const madeUp = (focusLetter, first, test) => {
      for (let t = 0; t < 14; t++) {
        const w = model.word(rng, allowed, focusLetter, 3, 7, first);
        if (w && !used.has(w) && (!test || test(w))) return w;
      }
      return null;
    };
    const preferReal = () => mode === "real" || (mode === "mixed" && rng() < 0.65);
    const take = (w) => { if (w) { used.add(w); out.push(w); } };

    for (let i = 0, n = Math.round(count * START_SHARE); i < n; i++) {
      const l = pickLetter();
      const cands = pool.filter((w) => w[0] === l);
      take((mode !== "pseudo" && cands.length && preferReal() ? realWord(cands) : null) || madeUp(l, l) || (cands.length ? realWord(cands) : null));
    }
    for (let i = 0, n = Math.round(count * MIDDLE_SHARE); i < n; i++) {
      const l = pickLetter();
      const inside = (w) => w.slice(1, -1).includes(l);
      const cands = pool.filter(inside);
      take((mode !== "pseudo" && cands.length && preferReal() ? realWord(cands) : null) || madeUp(l, null, inside) || (cands.length ? realWord(cands) : null));
    }
    const rest = general(count - out.length + 6).filter((w) => !used.has(w));
    while (out.length < count && rest.length) take(rest.shift());

    for (let i = out.length - 1; i > 0; i--) {   // mix them, so the tricky words are not all together
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  const capitalize = (w) => w[0].toUpperCase() + w.slice(1);

  // Adds capital letters and punctuation. With both on, text reads as sentences.
  function decorate(words, { capitals = false, punctuation = false } = {}, rng) {
    if (!capitals && !punctuation) return words.slice();
    let sentenceStart = true;
    return words.map((w, i) => {
      let s = w;
      if (capitals && (punctuation ? sentenceStart : i === 0 || rng() < 0.2)) s = capitalize(s);
      sentenceStart = false;
      if (punctuation) {
        if (i === words.length - 1) s += ".";
        else if (rng() < 0.14) {
          const mark = pick([",", ",", ".", ".", "?", "!", ";"], rng);
          s += mark;
          if (".?!".includes(mark)) sentenceStart = true;
        }
      }
      return s;
    });
  }

  // Replaces about one word in ten with a short number.
  function withNumbers(words, rng) {
    return words.map((w) => {
      if (rng() >= 0.1) return w;
      const len = 1 + Math.floor(rng() * 4);
      let n = "";
      for (let i = 0; i < len; i++) n += Math.floor(rng() * 10);
      return n;
    });
  }

  // Random everyday words with no immediate repeats, taken from the front of the common list.
  function commonWords(common, count, rng, { maxLen = 8, pool = 300 } = {}) {
    const list = common.slice(0, pool).filter((w) => w.length <= maxLen);
    const out = [];
    while (out.length < count) {
      const w = pick(list, rng);
      if (w !== out[out.length - 1]) out.push(w);
    }
    return out;
  }

  function pickSentences(sentences, count, rng) {
    const bag = sentences.slice();
    const out = [];
    while (out.length < count) {
      if (!bag.length) bag.push(...sentences);
      out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
    }
    return out;
  }

  const api = {
    LETTER_ORDER, makeRng, randomSeed, pick, WordModel,
    adaptiveWords, weakWords, decorate, withNumbers, commonWords, pickSentences, capitalize,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).textgen = api;
})(typeof window !== "undefined" ? window : globalThis);
