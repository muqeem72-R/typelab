/* TypeLab presence: counts the time a player is really on the site.
   A moment counts only while the tab is showing and the player has done something (a key, a click, a scroll)
   in the last few minutes, so a tab left open overnight does not add up to hours. Pure logic: the page feeds it
   the clock, whether the tab is showing and when the last input happened, and gets back how much time to add. */
(function (root) {
  "use strict";

  const IDLE_MS = 3 * 60 * 1000;   // without any input for this long, time stops counting
  const MAX_STEP_MS = 2500;        // one step never adds more than this, so a sleeping computer adds nothing

  class Presence {
    constructor({ idleMs = IDLE_MS, maxStepMs = MAX_STEP_MS, now = 0 } = {}) {
      this.idleMs = idleMs;
      this.maxStepMs = maxStepMs;
      this.last = null;          // the time of the previous step
      this.lastInput = now;      // arriving counts as input, so the clock starts as soon as the page opens
      this.visitMs = 0;          // time counted since this Presence was made (this visit)
    }

    input(now) { this.lastInput = now; }

    // Milliseconds to add for the time since the previous step (0 when the tab is hidden or the player is idle).
    step(now, visible) {
      const prev = this.last;
      this.last = now;
      if (prev == null || !visible) return 0;
      if (now - this.lastInput > this.idleMs) return 0;
      const add = Math.min(Math.max(0, now - prev), this.maxStepMs);
      this.visitMs += add;
      return add;
    }

    get idle() { return this.last != null && this.last - this.lastInput > this.idleMs; }
  }

  const api = { Presence, IDLE_MS, MAX_STEP_MS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).presence = api;
})(typeof window !== "undefined" ? window : globalThis);
