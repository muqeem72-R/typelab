/* TypeLab per-key statistics and the adaptive letter-unlocking rule.

   Every letter keeps a smoothed time-to-type. Confidence is target time divided by that
   time, so 1 means "this key is at the target speed". New letters unlock only when every
   letter already in play is at the target speed and accurate enough. */
(function (root) {
  "use strict";

  const M = typeof require === "function" ? require("./metrics.js") : root.TL.metrics;

  const KEY_ALPHA = 0.15;    // smoothing for a key's time
  const PAIR_ALPHA = 0.2;    // smoothing for a two-letter pair's time
  const HISTORY = 60;        // hit/miss outcomes remembered per key
  const MIN_SAMPLES = 3;     // a key needs this many samples before it has any confidence
  const MIN_KEYS = 6;        // letters in play at the very start
  const UNLOCK_ACCURACY = 0.93;
  const MAX_CONFUSIONS = 120;

  const blankKey = () => ({ time: null, n: 0, best: null, hist: "" });

  // state.keys, state.pairs and state.confusions are updated in place.
  function update(state, samples, confusions) {
    for (const s of samples) {
      const ch = s.ch.toLowerCase();
      const k = state.keys[ch] || (state.keys[ch] = blankKey());
      k.time = M.ema(k.time, s.ms, KEY_ALPHA);
      k.n++;
      if (s.ok && (k.best == null || s.ms < k.best)) k.best = s.ms;
      k.hist = (k.hist + (s.ok ? "1" : "0")).slice(-HISTORY);
      if (s.prev && /[a-z]/.test(ch) && /[a-z]/i.test(s.prev)) {
        const id = s.prev.toLowerCase() + ch;
        const p = state.pairs[id] || (state.pairs[id] = { time: null, n: 0, miss: 0 });
        p.time = M.ema(p.time, s.ms, PAIR_ALPHA);
        p.n++;
        if (!s.ok) p.miss++;
      }
    }
    for (const [want, got] of confusions || []) {
      const id = want.toLowerCase() + ">" + got.toLowerCase();
      state.confusions[id] = (state.confusions[id] || 0) + 1;
    }
    const ids = Object.keys(state.confusions);
    if (ids.length > MAX_CONFUSIONS * 2) {
      ids.sort((a, b) => state.confusions[b] - state.confusions[a]);
      for (const id of ids.slice(MAX_CONFUSIONS)) delete state.confusions[id];
    }
  }

  const confidence = (k, targetWpm) =>
    !k || k.n < MIN_SAMPLES || !k.time ? 0 : M.msFromSpeed(targetWpm) / k.time;

  // Share of recent presses of this key that were right first time, or null with too little data.
  const accuracy = (k) => {
    if (!k || k.hist.length < 5) return null;
    return (k.hist.split("1").length - 1) / k.hist.length;
  };

  const speed = (k) => (k && k.time ? M.speedFromMs(k.time) : null);

  function isDone(k, targetWpm) {
    const acc = accuracy(k);
    return confidence(k, targetWpm) >= 1 && (acc == null || acc >= UNLOCK_ACCURACY);
  }

  // Works out which letters are in play, which one to drill and how every letter is doing.
  // `unlocked` is how many letters the player has already earned; it never goes down.
  function plan(keys, order, unlocked, targetWpm) {
    let count = Math.min(order.length, Math.max(MIN_KEYS, unlocked));
    while (count < order.length && order.slice(0, count).every((c) => isDone(keys[c], targetWpm))) count++;
    const included = order.slice(0, count);

    let focus = null;
    let lowest = Infinity;
    for (const c of included) {
      if (isDone(keys[c], targetWpm)) continue;
      const conf = confidence(keys[c], targetWpm);
      if (conf < lowest) { lowest = conf; focus = c; }
    }

    const rows = order.map((ch, i) => {
      const k = keys[ch];
      let state = "locked";
      if (i < count) {
        if (isDone(k, targetWpm)) state = "done";
        else if (ch === focus) state = "focus";
        else state = k && k.n >= MIN_SAMPLES ? "learning" : "new";
      }
      return { ch, state, confidence: confidence(k, targetWpm), accuracy: accuracy(k), wpm: speed(k), n: k ? k.n : 0 };
    });

    return { count, unlockedNow: order.slice(Math.max(MIN_KEYS, unlocked), count), included, focus, rows };
  }

  const api = {
    MIN_KEYS, MIN_SAMPLES, UNLOCK_ACCURACY,
    blankKey, update, confidence, accuracy, speed, isDone, plan,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).keystats = api;
})(typeof window !== "undefined" ? window : globalThis);
