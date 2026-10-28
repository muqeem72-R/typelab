/* TypeLab visit clock: a small timer at the bottom right of every page. It starts the moment a player arrives and shows
   how long they have been here (this visit, today and in total) next to their real typing time. The time is saved with the
   player's progress and sent along with the leaderboard numbers, so the site owner can see how people use TypeLab. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt } = TL.ui;
  const SAVE_EVERY_MS = 10000;     // the clock is written to the browser's storage this often
  const SYNC_EVERY_MS = 180000;    // and to the server at most this often (every write to the server rewrites the board)

  function mount() {
    if (document.querySelector(".visit")) return null;
    const tracker = new TL.presence.Presence({ now: Date.now() });

    const t = h("span", { class: "visit-t" }, "0:00");
    const pill = h("button", { class: "visit-pill", type: "button", "aria-expanded": "false", "aria-controls": "visit-panel", title: "Time you have spent on TypeLab" },
      h("span", { class: "visit-dot", "aria-hidden": "true" }), t, h("span", { class: "visit-label" }, "here today"));
    const values = {};
    const row = (key, label) => {
      values[key] = h("span", { class: "visit-v" }, "0:00");
      return h("div", { class: "visit-row" }, h("span", null, label), values[key]);
    };
    const panel = h("div", { class: "visit-panel", id: "visit-panel", hidden: true, role: "group", "aria-label": "Your time on TypeLab" },
      h("h2", { class: "visit-h" }, "Your time on TypeLab"),
      row("visit", "This visit"), row("today", "Here today"), row("total", "Here, all time"),
      h("div", { class: "visit-sep" }),
      row("typedToday", "Real typing today"), row("typedTotal", "Real typing, all time"),
      h("p", { class: "visit-note" }, "Time here counts while this tab is showing and you are using it. Real typing counts only the seconds you are actually typing: breaks are left out. Both are saved with your progress."));
    const el = h("div", { class: "visit", role: "status" }, panel, pill);
    document.body.append(el);

    pill.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      pill.setAttribute("aria-expanded", String(!panel.hidden));
      update();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; pill.setAttribute("aria-expanded", "false"); }
    });

    // What the run that is still going on has typed so far (set by the Practice page), so the numbers move while typing.
    const liveTyped = () => (typeof TL.liveTyping === "function" ? TL.liveTyping() : 0);

    function update() {
      const today = TL.store.siteMsToday();
      t.textContent = fmt.stopwatch(today);
      if (panel.hidden) return;
      const a = TL.store.activitySummary();
      const live = liveTyped();
      values.visit.textContent = fmt.stopwatch(tracker.visitMs);
      values.today.textContent = fmt.stopwatch(today);
      values.total.textContent = fmt.duration(a.site);
      values.typedToday.textContent = fmt.stopwatch(a.todayTyped + live);
      values.typedTotal.textContent = fmt.duration(a.typed + live);
    }

    let lastSave = Date.now();
    let lastSync = Date.now();
    let dirty = false;        // time added since the last save
    let unsent = false;       // time saved but not yet sent to the server

    function flush() {
      if (dirty) { TL.store.flushTime(); dirty = false; unsent = true; lastSave = Date.now(); }
      // not right after another update: the server answers "too fast" to two updates within a second and a half
      if (unsent && TL.account.loggedIn() && TL.account.sinceLastSync() >= 4000) { unsent = false; lastSync = Date.now(); TL.account.sync(); }
    }

    function tick() {
      const now = Date.now();
      const add = tracker.step(now, document.visibilityState !== "hidden");
      if (add) { TL.store.addSite(add, now); dirty = true; }
      el.classList.toggle("idle", !add);
      update();
      if (dirty && now - lastSave >= SAVE_EVERY_MS) { TL.store.flushTime(); dirty = false; unsent = true; lastSave = now; }
      if (unsent && now - lastSync >= SYNC_EVERY_MS && TL.account.loggedIn()) { unsent = false; lastSync = now; TL.account.syncSoon(300); }
    }

    const onInput = () => tracker.input(Date.now());
    for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"]) {
      root.addEventListener(ev, onInput, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    root.addEventListener("pagehide", flush);

    update();
    setInterval(tick, 1000);
    return { tracker, el, update, flush };
  }

  (TL.ui = TL.ui || {}).visit = { mount };
})(window);
