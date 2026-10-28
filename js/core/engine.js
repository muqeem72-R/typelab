/* TypeLab typing engine: one Session per piece of text. It knows nothing about the page.
   Feed it key presses with a timestamp and it keeps score.

   A wrong key never moves on. It counts as a mistake and the caret stays, so a character is
   only left behind once it has been typed correctly. Backspace is not needed (and not used). */
(function (root) {
  "use strict";

  const M = typeof require === "function" ? require("./metrics.js") : root.TL.metrics;

  // marks[i]: 0 not typed yet, 1 correct first time, 2 correct after at least one mistake
  class Session {
    constructor(text, opts = {}) {
      this.text = text;
      this.n = text.length;
      this.limitMs = opts.limitMs || null;
      this.endless = !!opts.endless;   // an endless run never finishes by reaching the end: more text is appended
      this.pos = 0;
      this.marks = new Array(this.n).fill(0);
      this.hadError = new Array(this.n).fill(false);
      this.startAt = null;
      this.pausedAt = null;
      this.endMs = null;
      this.finished = false;
      this.correct = 0;
      this.presses = 0;
      this.wrong = 0;
      this.wrongStreak = 0;  // wrong keys in a row on the current character
      this.events = [];      // { t, c, ok } for the per-second chart
      this.samples = [];     // { ch, prev, ms, ok } for the per-key statistics
      this.confusions = [];  // [expected, typed] pairs
      this.lastT = null;
      this.prevCh = null;
      this.activeMs = 0;         // time actually spent typing: the gaps between keys, each counted up to 2 seconds
      this.lastPressAt = null;   // when the last key was pressed (absolute time), for idle detection
      this.drainedSamples = 0;
      this.drainedConfusions = 0;
    }

    get started() { return this.startAt != null; }
    get running() { return this.started && !this.finished && this.pausedAt == null; }

    // Returns { ok, expected, typed, streak } for a typed character, or null when the key was ignored.
    // streak is how many wrong keys in a row have now been pressed for this character (0 when ok).
    press(key, now) {
      if (this.finished || this.pausedAt != null || this.pos >= this.n) return null;
      if (this.startAt == null) this.startAt = now;
      this.lastPressAt = now;
      const t = now - this.startAt;
      if (this.limitMs != null && t >= this.limitMs) {
        this.finish(now);
        return null;
      }
      const expected = this.text[this.pos];
      const ok = key === expected;
      this.presses++;
      if (ok) {
        this.marks[this.pos] = this.hadError[this.pos] ? 2 : 1;
        this.correct++;
        this.sample(expected, t, !this.hadError[this.pos]);
        this.pos++;
        this.wrongStreak = 0;
      } else {
        this.wrong++;
        this.wrongStreak++;
        this.hadError[this.pos] = true;
        this.confusions.push([expected, key]);
      }
      this.events.push({ t, c: this.correct, ok });
      const streak = this.wrongStreak;
      if (this.pos >= this.n && !this.endless) this.finish(now);
      return { ok, expected, typed: key, streak };
    }

    // Adds more text after the end (endless runs). Typing carries on with no break.
    append(more) {
      this.text += more;
      this.n = this.text.length;
      for (let i = 0; i < more.length; i++) {
        this.marks.push(0);
        this.hadError.push(false);
      }
    }

    // The letters mistyped most often since character number `from`, worst first (at most `limit` of
    // them). A mistake is counted once per character, however many wrong keys it took to get past it.
    recentMistakes(from = 0, limit = 3) {
      const counts = {};
      for (let i = Math.max(0, from); i < this.pos; i++) {
        if (!this.hadError[i]) continue;
        const c = this.text[i].toLowerCase();
        if (/[a-z]/.test(c)) counts[c] = (counts[c] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([c]) => c);
    }

    // How many whole words have been typed so far (a word is finished when its space is typed).
    wordsTyped() {
      let n = 0;
      for (let i = 0; i < this.pos; i++) if (this.text[i] === " ") n++;
      return n;
    }

    // Per-key samples and mistakes that have not been handed over yet, so statistics can be updated
    // a little at a time while the run goes on. The full lists are kept for the final summary.
    pendingSamples() { return this.samples.length - this.drainedSamples; }
    takeSamples() {
      const out = this.samples.slice(this.drainedSamples);
      this.drainedSamples = this.samples.length;
      return out;
    }
    takeConfusions() {
      const out = this.confusions.slice(this.drainedConfusions);
      this.drainedConfusions = this.confusions.length;
      return out;
    }

    // After a long gap with no key, stops the clock as of shortly after the last key, so a coffee
    // break does not drag the speed down. Returns true when it paused.
    pauseIfIdle(now, idleMs) {
      if (!this.running || this.lastPressAt == null || now - this.lastPressAt <= idleMs) return false;
      this.pausedAt = this.lastPressAt + 2000;
      return true;
    }

    sample(ch, t, ok) {
      if (this.lastT != null) {
        const ms = M.clampInterval(t - this.lastT);
        this.activeMs += ms;
        this.samples.push({ ch, prev: this.prevCh, ms, ok });
      }
      this.lastT = t;
      this.prevCh = ch;
    }

    pause(now) {
      if (this.running) this.pausedAt = now;
    }

    // The paused time is cut out of the clock, so the pause cannot lower the speed.
    resume(now) {
      if (this.pausedAt != null) {
        this.startAt += now - this.pausedAt;
        this.pausedAt = null;
      }
    }

    // Called on a timer. Ends a timed test when its time is up.
    tick(now) {
      if (this.running && this.limitMs != null && now - this.startAt >= this.limitMs) this.finish(now);
    }

    finish(now) {
      if (this.finished) return;
      this.finished = true;
      const elapsed = this.startAt == null ? 0 : now - this.startAt;
      this.endMs = this.limitMs != null ? Math.min(elapsed, this.limitMs) : elapsed;
    }

    elapsed(now) {
      if (this.finished) return this.endMs;
      if (this.startAt == null) return 0;
      return (this.pausedAt != null ? this.pausedAt : now) - this.startAt;
    }

    // Speed over the last `windowMs` of typing, so a long run shows how you are typing now and
    // not a slowly settling average.
    rollingWpm(now, windowMs = 15000) {
      const ms = this.elapsed(now);
      if (ms <= 0) return 0;
      const from = Math.max(0, ms - windowMs);
      let i = this.events.length - 1;
      while (i >= 0 && this.events[i].t >= from) i--;
      const before = i >= 0 ? this.events[i].c : 0;
      return M.wpm(this.correct - before, Math.max(ms - from, 1000));
    }

    // Share of the last `count` key presses that were right.
    rollingAccuracy(count = 100) {
      const recent = this.events.slice(-count);
      return M.accuracy(recent.filter((e) => e.ok).length, recent.length);
    }

    // The numbers shown while typing. Speed is held to a one-second minimum window
    // so the first keystrokes do not make it jump around.
    live(now) {
      const ms = this.elapsed(now);
      return {
        ms,
        wpm: ms > 0 ? M.wpm(this.correct, Math.max(ms, 1000)) : 0,
        accuracy: M.accuracy(this.presses - this.wrong, this.presses),
        rollingWpm: this.rollingWpm(now),
        rollingAccuracy: this.rollingAccuracy(),
        errors: this.wrong,
        pos: this.pos,
        n: this.n,
      };
    }

    summary() {
      const ms = this.endMs != null ? this.endMs : 0;
      return {
        netWpm: M.wpm(this.correct, ms),
        rawWpm: M.wpm(this.presses, ms),
        accuracy: M.accuracy(this.presses - this.wrong, this.presses),
        errors: this.wrong,
        chars: this.correct,
        presses: this.presses,
        ms,
        activeMs: Math.round(this.activeMs),
        consistency: M.consistency(this.samples.map((s) => s.ms)),
        series: M.series(this.events, ms),
      };
    }
  }

  const api = { Session };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).engine = api;
})(typeof window !== "undefined" ? window : globalThis);
