/* TypeLab storage: everything about one player lives in this browser's localStorage under one key.
   A guest uses "typeLab.data". A logged-in player uses "typeLab.data.<profile key>", so two people
   sharing a browser keep separate progress. If storage is blocked the app still works for the
   visit and simply forgets afterwards. */
(function (root) {
  "use strict";

  const KEY = "typeLab.data";
  const THEME_KEY = "typeLab.theme";
  const VERSION = 1;
  const MAX_SESSIONS = 1000;
  const MODES = ["adaptive", "time", "words", "sentences", "code"];
  // A day counts towards the streak once the player has typed for this long that day. Only time
  // spent typing counts: opening the app, or typing a few words, does not.
  const STREAK_MS = 5 * 60 * 1000;
  const TOURS = ["nav", "home", "practice", "course", "lesson", "progress", "settings"];

  const defaults = () => ({
    v: VERSION,
    settings: {
      targetWpm: 35,
      wordsMode: "mixed",
      mode: "adaptive",
      capitals: false,
      punctuation: false,
      numbers: false,
      symbols: false,
      showKeyboard: true,
      showHands: true,
      handTone: "medium",
      sound: true,
      volume: 60,
      unlockAllLessons: false,
      testTime: 30,
      testWords: 25,
      testSentences: 3,
      testCode: 3,
      testLang: "all",
      testPunctuation: false,
      testNumbers: false,
    },
    adaptive: { unlocked: 6 },
    keys: {},
    pairs: {},
    confusions: {},
    sessions: [],
    course: {},
    days: {},
    bests: {},
    certs: {},
    badges: {},
    tours: {},
  });

  let state = null;
  let blocked = false;
  let namespace = "";

  const dataKey = (ns = namespace) => KEY + (ns ? "." + ns : "");
  const num = (v, fallback, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
  const round1 = (v) => Math.round(v * 10) / 10;

  // Takes anything that was parsed from storage or from an import file and returns a safe state.
  function clean(raw) {
    const d = defaults();
    if (!raw || typeof raw !== "object") return d;
    const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    for (const k of Object.keys(d.settings)) {
      if (typeof s[k] === typeof d.settings[k]) d.settings[k] = s[k];
    }
    d.settings.targetWpm = num(d.settings.targetWpm, 35, 10, 150);
    if (!["mixed", "real", "pseudo"].includes(d.settings.wordsMode)) d.settings.wordsMode = "mixed";
    if (!MODES.includes(d.settings.mode)) d.settings.mode = "adaptive";
    if (![15, 30, 60, 120].includes(d.settings.testTime)) d.settings.testTime = 30;
    if (![10, 25, 50, 100].includes(d.settings.testWords)) d.settings.testWords = 25;
    if (![1, 3, 5].includes(d.settings.testSentences)) d.settings.testSentences = 3;
    if (![1, 3, 5].includes(d.settings.testCode)) d.settings.testCode = 3;
    if (!["all", "javascript", "python", "html", "css", "sql", "shell"].includes(d.settings.testLang)) d.settings.testLang = "all";
    if (!["fair", "light", "medium", "brown", "deep"].includes(d.settings.handTone)) d.settings.handTone = "medium";
    d.settings.volume = num(d.settings.volume, 60, 0, 100);
    d.adaptive.unlocked = num(raw.adaptive && raw.adaptive.unlocked, 6, 6, 26);

    const dict = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    for (const [ch, k] of Object.entries(dict(raw.keys))) {
      if (ch.length === 1 && k && Number.isFinite(k.n)) {
        d.keys[ch] = {
          time: Number.isFinite(k.time) ? k.time : null,
          n: k.n,
          best: Number.isFinite(k.best) ? k.best : null,
          hist: typeof k.hist === "string" ? k.hist.replace(/[^01]/g, "").slice(-60) : "",
        };
      }
    }
    for (const [id, p] of Object.entries(dict(raw.pairs))) {
      if (/^[a-z]{2}$/.test(id) && p && Number.isFinite(p.n)) {
        d.pairs[id] = { time: Number.isFinite(p.time) ? p.time : null, n: p.n, miss: num(p.miss, 0, 0, p.n) };
      }
    }
    for (const [id, n] of Object.entries(dict(raw.confusions))) {
      if (/^.>.$/.test(id) && Number.isFinite(n)) d.confusions[id] = n;
    }
    if (Array.isArray(raw.sessions)) {
      d.sessions = raw.sessions
        .filter((x) => x && Number.isFinite(x.ts) && Number.isFinite(x.wpm) && typeof x.kind === "string")
        .slice(-MAX_SESSIONS)
        .map((x) => ({
          ts: x.ts,
          kind: x.kind.slice(0, 12),
          mode: [...MODES, "course"].includes(x.mode) ? x.mode : undefined,
          label: typeof x.label === "string" ? x.label.slice(0, 40) : "",
          wpm: x.wpm,
          raw: num(x.raw, x.wpm, 0, 1000),
          acc: num(x.acc, 100, 0, 100),
          errors: num(x.errors, 0, 0, 1e6),
          ms: num(x.ms, 0, 0, 1e9),
          chars: num(x.chars, 0, 0, 1e6),
          letters: Number.isFinite(x.letters) ? num(x.letters, 0, 0, 26) : undefined,
          cons: Number.isFinite(x.cons) ? x.cons : null,
        }));
    }
    for (const [id, c] of Object.entries(dict(raw.course))) {
      if (/^\d+$/.test(id) && c && Number.isFinite(c.stars)) {
        d.course[id] = { stars: num(c.stars, 0, 0, 3), wpm: num(c.wpm, 0, 0, 1000), acc: num(c.acc, 0, 0, 100), tries: num(c.tries, 0, 0, 1e6) };
      }
    }
    for (const [id, day] of Object.entries(dict(raw.days))) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(id) && day && Number.isFinite(day.n)) {
        d.days[id] = { n: day.n, ms: num(day.ms, 0, 0, 1e9), chars: num(day.chars, 0, 0, 1e9) };
        if (Number.isFinite(day.act)) d.days[id].act = num(day.act, 0, 0, 1e9);
      }
    }
    for (const [id, b] of Object.entries(dict(raw.bests))) {
      if (b && Number.isFinite(b.wpm)) d.bests[id.slice(0, 30)] = { wpm: b.wpm, acc: num(b.acc, 100, 0, 100), ts: num(b.ts, 0, 0, 1e15) };
    }
    for (const tier of ["core", "programmer"]) {
      const c = dict(raw.certs)[tier];
      if (c && typeof c.code === "string" && c.code.length <= 2000 && /^[A-Za-z0-9_.-]+$/.test(c.code)) d.certs[tier] = { code: c.code, ts: num(c.ts, 0, 0, 1e15) };
    }
    for (const [id, ts] of Object.entries(dict(raw.badges))) {
      if (/^[a-z0-9]{2,20}$/.test(id) && Number.isFinite(ts)) d.badges[id] = ts;
    }
    for (const [id, ts] of Object.entries(dict(raw.tours))) {
      if (TOURS.includes(id) && Number.isFinite(ts)) d.tours[id] = ts;
    }
    return d;
  }

  // Chooses whose data is loaded: "" is the guest, anything else is a logged-in profile's key.
  function use(ns) {
    namespace = ns || "";
    state = null;
  }

  function load() {
    if (state) return state;
    let raw = null;
    try {
      const text = localStorage.getItem(dataKey());
      if (text) raw = JSON.parse(text);
    } catch (e) { blocked = true; }
    state = clean(raw);
    return state;
  }

  function save() {
    if (!state) return;
    try { localStorage.setItem(dataKey(), JSON.stringify(state)); }
    catch (e) { blocked = true; }
  }

  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  // Adds one finished session to the history, the day totals and the personal bests.
  // `bestKey` names what the best is for ("time:30", "practice", "lesson:4"). Returns whether it is a new best.
  // `mode` is the practice mode ("adaptive", "time", ...); `letters` is how many letters were in play.
  function recordSession({ kind, mode, letters, label, bestKey, summary }) {
    const st = load();
    const ts = Date.now();
    const entry = {
      ts, kind, mode: kind === "course" ? "course" : mode || (kind === "test" ? "time" : "adaptive"), label: label || "",
      wpm: round1(summary.netWpm), raw: round1(summary.rawWpm), acc: round1(summary.accuracy),
      errors: summary.errors, ms: Math.round(summary.ms), chars: summary.chars,
      cons: summary.consistency,
    };
    if (letters != null) entry.letters = letters;
    st.sessions.push(entry);
    if (st.sessions.length > MAX_SESSIONS) st.sessions.splice(0, st.sessions.length - MAX_SESSIONS);

    const dk = dayKey(new Date(ts));
    const day = st.days[dk] || (st.days[dk] = { n: 0, ms: 0, chars: 0, act: 0 });
    if (!Number.isFinite(day.act)) day.act = day.ms;   // a day saved before typing time was tracked
    day.n++;
    day.ms += Math.round(summary.ms);
    day.act += Math.round(summary.activeMs != null ? summary.activeMs : summary.ms);
    day.chars += summary.chars;

    let isBest = false;
    if (bestKey) {
      const prev = st.bests[bestKey];
      if (!prev || summary.netWpm > prev.wpm) {
        st.bests[bestKey] = { wpm: round1(summary.netWpm), acc: round1(summary.accuracy), ts };
        isBest = !!prev;   // the very first result is a record too, but not worth a banner
      }
    }
    save();
    return { isBest };
  }

  // Time spent typing on a saved day (older saves only have the total session time, which is used instead).
  const activeOf = (day) => (!day ? 0 : Number.isFinite(day.act) ? day.act : day.ms);

  const todayActiveMs = () => activeOf(load().days[dayKey(new Date())]);

  // Consecutive days on which the player typed for at least STREAK_MS, counting back from today. While
  // today is still short of that, the streak is not broken yet: it counts back from yesterday.
  // `todayActive` lets a run in progress count towards today before it is saved.
  function streak(todayActive) {
    const st = load();
    const d = new Date();
    const todayKey = dayKey(d);
    const active = (key) => (key === todayKey && todayActive != null ? todayActive : activeOf(st.days[key]));
    if (active(dayKey(d)) < STREAK_MS) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active(dayKey(d)) >= STREAK_MS) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  const todayMs = () => (load().days[dayKey(new Date())] || { ms: 0 }).ms;

  const exportJson = () => JSON.stringify(load(), null, 2);

  function importJson(text) {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || raw.v !== VERSION) throw new Error("This file is not a TypeLab backup.");
    state = clean(raw);
    save();
  }

  function reset() {
    state = defaults();
    save();
  }

  // Tours are shown once. Marking one done (finished or skipped) saves it with the player's data.
  const tourDone = (name) => !!load().tours[name];
  function markTour(name) {
    if (!TOURS.includes(name)) return;
    load().tours[name] = Date.now();
    save();
  }
  function resetTours() {
    load().tours = {};
    save();
  }

  const api = {
    KEY, THEME_KEY, MODES, TOURS, STREAK_MS, defaults, clean, use, load, save, dayKey, recordSession, streak, todayMs, todayActiveMs, activeOf,
    exportJson, importJson, reset, dataKey, tourDone, markTour, resetTours,
    get blocked() { return blocked; },
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).store = api;
})(typeof window !== "undefined" ? window : globalThis);
