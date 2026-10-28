/* TypeLab shared page helpers: the adaptive plan, key table, forecast text and daily goal bar. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;
  const TG = TL.textgen;
  const KS = TL.keystats;

  let model = null;

  const STATE_LABEL = {
    done: "✓ At target",
    focus: "◎ Focus",
    learning: "… Learning",
    new: "★ New",
  };

  const shared = {
    order: [...TG.LETTER_ORDER],

    words: () => TL.data.words.words,
    common: () => TL.data.words.common,
    sentences: () => TL.data.sentences.sentences,
    model: () => model || (model = new TG.WordModel(TL.data.words.words)),
    rng: () => TG.makeRng(TG.randomSeed()),

    // The current adaptive plan. Letters earned in any mode are saved here, so a letter that
    // unlocks after a test or a lesson is not lost. plan.unlockedNow lists what is new.
    plan() {
      const st = TL.store.load();
      const plan = KS.plan(st.keys, shared.order, st.adaptive.unlocked, st.settings.targetWpm);
      if (plan.count > st.adaptive.unlocked) {
        st.adaptive.unlocked = plan.count;
        TL.store.save();
      }
      return plan;
    },

    // Feeds a finished session into the per-key statistics.
    learn(session) {
      const st = TL.store.load();
      KS.update(st, session.samples, session.confusions);
    },

    // Adaptive levels: level 1 is the starting six letters, and every letter after that is one more level.
    MAX_LEVEL: 21,
    levelOf: (plan) => Math.max(1, plan.count - 5),

    // One letter in the letters strip. `fresh` letters get a short highlight when a level has just been reached,
    // and `tricky` letters are marked as the ones the player keeps mistyping.
    chip(r, fresh, tricky) {
      const letter = r.ch.toUpperCase();
      const label = r.state === "locked" ? `${letter}: locked`
        : r.n ? `${letter}: ${Math.round(r.wpm)} WPM` + (r.accuracy == null ? "" : `, ${Math.round(r.accuracy * 100)}% accurate`)
          : `${letter}: no data yet`;
      const fillEl = h("span", { class: "chip-fill" });
      fillEl.style.width = Math.min(100, r.confidence * 100) + "%";
      return h("li", { class: "chip " + r.state + (fresh ? " fresh" : "") + (tricky ? " tricky" : ""), title: label, "aria-label": label + (r.state === "focus" ? ", focus letter" : "") + (tricky ? ", tricky letter" : "") },
        h("span", { class: "chip-ch" }, letter), h("span", { class: "chip-meter", "aria-hidden": "true" }, fillEl));
    },

    // Works out which achievements were earned since the last time, saves them and returns the new ones.
    newBadges() {
      const st = TL.store.load();
      const fresh = [];
      for (const a of TL.rank.achievements(st, TL.store.streak())) {
        if (a.earned && !st.badges[a.id]) {
          st.badges[a.id] = Date.now();
          fresh.push(a);
        }
      }
      if (fresh.length) TL.store.save();
      return fresh;
    },

    card: (title, ...kids) => h("section", { class: "card" }, title ? h("h3", { class: "sub" }, title) : null, ...kids),

    keyTable(plan) {
      const rows = plan.rows.filter((r) => r.state !== "locked");
      return h("div", { class: "table-wrap" }, h("table", { class: "keytable" },
        h("thead", null, h("tr", null, ...["Letter", "Speed", "Accuracy", "Status"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, ...rows.map((r) => h("tr", { class: r.state },
          h("th", { scope: "row" }, r.ch.toUpperCase()),
          h("td", null, r.wpm ? Math.round(r.wpm) + " WPM" : "-"),
          h("td", null, r.accuracy == null ? "-" : Math.round(r.accuracy * 100) + "%"),
          h("td", null, STATE_LABEL[r.state] || ""))))));
    },

    forecast() {
      const st = TL.store.load();
      const target = st.settings.targetWpm;
      const p = TL.metrics.projection(st.sessions.filter((s) => s.kind === "practice").map((s) => s.wpm), target);
      if (!p) return "Finish a few more practice sessions to see a forecast of when you will reach your target.";
      if (p.remaining === 0) return `Your trend has reached your target of ${target} WPM. Consider raising it in Settings.`;
      if (p.remaining == null) return `At this pace your target of ${target} WPM is more than 50 sessions away. Keep going, and focus on accuracy.`;
      return `If your trend continues, you reach ${target} WPM in about ${p.remaining} more practice session${p.remaining === 1 ? "" : "s"}.`;
    },

    // The daily streak box. A day counts once you have typed for 5 minutes (only typing counts, not visiting).
    // The returned element has update(extraMs): pass the typing time of a run that is still going and
    // the box shows it straight away, before the run is saved.
    goal() {
      const need = TL.store.STREAK_MS;
      const mmss = (ms) => TL.ui.fmt.clock(Math.min(ms, 99 * 60000));
      const fillEl = h("span", { class: "meter-fill" });
      const meter = h("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(need / 1000) }, fillEl);
      const today = h("span", null);
      const streakEl = h("span", { class: "streak-count" });
      const note = h("p", { class: "goal-note" });
      const box = h("div", { class: "goal" }, h("div", { class: "goal-t" }, today, streakEl), meter, note);

      box.update = (extraMs = 0) => {
        const active = TL.store.todayActiveMs() + extraMs;
        const done = active >= need;
        const streak = TL.store.streak(active);
        fillEl.style.width = Math.min(100, (active / need) * 100) + "%";
        meter.setAttribute("aria-valuenow", String(Math.round(Math.min(active, need) / 1000)));
        meter.setAttribute("aria-valuetext", `${mmss(active)} of ${mmss(need)} typed today`);
        box.classList.toggle("done", done);
        today.textContent = done ? `✓ Streak day done: ${mmss(active)} typed today` : `Today: ${mmss(active)} of ${mmss(need)} typed`;
        streakEl.textContent = streak ? `${streak}-day streak` : "No streak yet";
        note.textContent = done
          ? "Nice work. Typing more is always good, but today already counts."
          : `Type ${mmss(need - active)} more today to ${streak ? `make it a ${streak + 1}-day streak` : "start your streak"}. Only real typing counts, not just visiting.`;
      };
      box.update(0);
      return box;
    },

    stars(n, total = 3) {
      return h("span", { class: "stars", role: "img", "aria-label": `${n} of ${total} stars` },
        ...Array.from({ length: total }, (_, i) => h("span", { class: i < n ? "on" : "" }, i < n ? "★" : "☆")));
    },

    banner(kind, strong, rest) {
      const icon = { good: "✓", warn: "!", bad: "✕" }[kind] || "";
      return h("p", { class: "banner " + kind }, h("span", { class: "banner-i", "aria-hidden": "true" }, icon), h("span", null, h("strong", null, strong), rest ? " " + rest : ""));
    },
  };

  TL.shared = shared;
})(window);
