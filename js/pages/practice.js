/* TypeLab page: practice. One page for everything you type outside the course.

   Adaptive (the main mode) is an endless run. Text keeps arriving, the letters you know get faster,
   and new letters unlock while you type. A level-up is shown as a short message over the text and
   as a highlighted letter. Nothing stops, resets or asks for a click. The run ends only when you
   press Finish (or leave the page), and then the whole run is saved as one session.

   Timed, Words, Sentences and Code are the speed tests: they have a fixed length, end by themselves
   and show a result. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;
  const S = TL.shared;
  const TG = TL.textgen;
  const KS = TL.keystats;

  const MODES = [["adaptive", "Adaptive"], ["time", "Timed"], ["words", "Words"], ["sentences", "Sentences"], ["code", "Code"]];
  const MODE_HELP = {
    adaptive: "An endless run. Letters unlock as you get faster, and you never have to stop.",
    time: "Type everyday words against the clock.",
    words: "Type a set number of everyday words.",
    sentences: "Type full sentences with capitals and punctuation.",
    code: "Type real one-line code snippets full of symbols.",
  };
  const AMOUNTS = {
    time: ["testTime", [15, 30, 60, 120], (v) => v + " s"],
    words: ["testWords", [10, 25, 50, 100], (v) => v + " words"],
    sentences: ["testSentences", [1, 3, 5], (v) => v + (v === 1 ? " sentence" : " sentences")],
    code: ["testCode", [1, 3, 5], (v) => v + (v === 1 ? " snippet" : " snippets")],
  };
  const LANGS = [["all", "All languages"], ["javascript", "JavaScript"], ["python", "Python"], ["html", "HTML"], ["css", "CSS"], ["sql", "SQL"], ["shell", "Shell and git"]];

  // Words come in batches. The first 20 words of a run are ordinary adaptive words. After that every batch has
  // 15 words, and the next batch is built from the mistakes of the batches just typed.
  const FIRST_BATCH_WORDS = 20;
  const BATCH_WORDS = 15;
  const FLUSH_SAMPLES = 24;     // key measurements gathered before the letter statistics are updated
  const MIN_RUN_MS = 5000;      // a run shorter than this (and with fewer than MIN_RUN_CHARS characters) is not saved
  const MIN_RUN_CHARS = 15;

  const symbolTokens = () => TL.lessons.LESSONS.filter((l) => l.coder && l.tokens).flatMap((l) => l.tokens);

  function mount(main) {
    const st = TL.store.load();
    const s = st.settings;
    const bar = h("div", { class: "filters" });
    const help = h("p", { class: "muted mode-help" });
    const levelBox = h("section", { class: "level", "aria-label": "Your level" });
    const goalHost = h("div");
    const host = h("div");
    const finishBtn = h("button", { class: "btn primary", type: "button", onclick: () => screen.finishNow() }, "Finish and see results");

    let plan = S.plan();
    let run = null;          // the adaptive run in progress: { levelsGained, recorded }
    let finiteText = "";     // the text of the speed test in progress, so "Same text again" can repeat it
    let fresh = new Set();   // letters unlocked a moment ago, highlighted in the strip
    let goalBox = null;      // the streak box and whether today's "streak day complete" message was shown
    let streakToasted = false;

    // ---- text for each mode ------------------------------------------------------------------

    function activeKeys() {
      if (s.mode !== "adaptive") return null;
      if (s.numbers || s.symbols) return null;
      return new Set([...plan.included, " ", ...(s.punctuation ? ",.?!;" : "")]);
    }

    // The letters the next batch should aim at: the ones mistyped most in the last two batches. Nothing
    // until 20 words have been typed, and nothing if there were no mistakes.
    function trickyLetters(session) {
      if (!session || !run || session.wordsTyped() < FIRST_BATCH_WORDS - 1) return [];   // the 20th word's last space is not typed yet
      const starts = run.batchStarts;
      const from = starts.length >= 2 ? starts[starts.length - 2] : 0;
      return session.recentMistakes(from).filter((c) => plan.included.includes(c));
    }

    // One batch of words as text. It ends with a space, so the last key of a batch is a space and the
    // next batch can be added before that key is typed: typing never has to wait for words.
    // About a third of the words start with a tricky letter and about a third have one in the middle.
    function makeBatch(count, session) {
      const rng = S.rng();
      const weak = trickyLetters(session);
      if (run) run.tricky = weak;
      const input = { words: S.words(), model: S.model(), included: plan.included, focus: plan.focus, count, mode: "real", rng };
      let words = weak.length ? TG.weakWords({ ...input, weak }) : TG.adaptiveWords(input);
      if (s.numbers) words = TG.withNumbers(words, rng);
      if (s.symbols) {
        const bank = symbolTokens();
        words = words.map((w) => (rng() < 0.12 ? TG.pick(bank, rng) : w));
      }
      return TG.decorate(words, { capitals: s.capitals, punctuation: s.punctuation }, rng).join(" ") + " ";
    }

    function testConfig() {
      const mode = s.mode;
      const [field, , label] = AMOUNTS[mode];
      const amount = s[field];
      const fixed = mode === "sentences" || mode === "code";   // these bring their own text
      const punct = s.testPunctuation && !fixed;
      const numbers = s.testNumbers && !fixed;
      const lang = mode === "code" ? s.testLang : null;
      const key = `${mode}:${amount}${lang ? ":" + lang : ""}${punct ? "+p" : ""}${numbers ? "+n" : ""}`;
      const langName = lang ? ", " + LANGS.find(([v]) => v === lang)[1] : "";
      return { mode, amount, punct, numbers, lang, fixed, key, label: label(amount) + langName + (punct ? ", punctuation" : "") + (numbers ? ", numbers" : "") };
    }

    function testText() {
      const c = testConfig();
      const rng = S.rng();
      if (c.mode === "sentences") return TG.pickSentences(S.sentences(), c.amount, rng).join(" ");
      if (c.mode === "code") return TG.pickSentences(c.lang === "all" ? TL.data.code.all : TL.data.code.byLang[c.lang], c.amount, rng).join(" ");
      const count = c.mode === "time" ? Math.max(60, Math.ceil((c.amount / 60) * 250)) : c.amount;
      let words = TG.commonWords(S.common(), count, rng);
      if (c.numbers) words = TG.withNumbers(words, rng);
      return TG.decorate(words, { capitals: c.punct, punctuation: c.punct }, rng).join(" ");
    }

    // ---- adaptive run ------------------------------------------------------------------------

    function renderLevel() {
      levelBox.hidden = s.mode !== "adaptive";
      if (levelBox.hidden) return;
      const level = S.levelOf(plan);
      const focus = plan.focus ? plan.rows.find((r) => r.ch === plan.focus) : null;
      const next = plan.count < S.order.length ? S.order[plan.count].toUpperCase() : null;
      const note = focus
        ? `Focus letter ${focus.ch.toUpperCase()}: ${focus.wpm ? Math.round(focus.wpm) : 0} of ${s.targetWpm} WPM`
        : next ? `Every letter is at ${s.targetWpm} WPM. ${next} unlocks next.` : "All 26 letters are unlocked.";
      const tricky = new Set(run ? run.tricky : []);
      levelBox.textContent = "";
      levelBox.append(
        h("div", { class: "level-head" },
          h("span", { class: "level-badge" }, "Level " + level),
          h("span", { class: "muted" }, `of ${S.MAX_LEVEL}`)),
        h("p", { class: "level-note" }, note),
        h("ul", { class: "chips", "aria-label": "Your letters" }, ...plan.rows.map((r) => S.chip(r, fresh.has(r.ch), tricky.has(r.ch)))),
        h("p", { class: "tricky-note" + (tricky.size ? " active" : "") }, tricky.size
          ? `The latest words aim at your tricky letters: ${[...tricky].map((c) => c.toUpperCase()).join(", ")}.`
          : `Words come in batches. After 20 words, each new batch of ${BATCH_WORDS} aims at the letters you mistype.`));
    }

    function barValue() {
      const focus = plan.focus ? plan.rows.find((r) => r.ch === plan.focus) : null;
      return focus ? Math.min(1, focus.confidence) : 1;
    }

    // Updates the letter statistics from the keys typed so far and checks whether a level was reached.
    // It runs a little at a time while typing, so it does only a small amount of work.
    function flush() {
      const session = screen.session;
      if (!session || !run) return;
      const samples = session.takeSamples();
      const confusions = session.takeConfusions();
      if (samples.length || confusions.length) KS.update(st, samples, confusions);
      const before = plan.count;
      const after = S.plan();   // also saves any new unlock
      plan = after;
      if (after.count > before && !session.finished) levelUp(before, after);
      TL.store.save();
      renderLevel();
    }

    function levelUp(before, after) {
      const letters = S.order.slice(before, after.count).map((c) => c.toUpperCase());
      const level = S.levelOf(after);
      run.levelsGained.push({ level, letters });
      fresh = new Set(S.order.slice(before, after.count));
      setTimeout(() => { fresh = new Set(); renderLevel(); }, 4500);
      screen.toast(`Level ${level}! ${letters.join(", ")} unlocked`, "good");
      if (s.sound) TL.ui.sound.play("level", s.volume);
      screen.keyboard.setActive(activeKeys());
    }

    function startAdaptive() {
      plan = S.plan();
      run = { levelsGained: [], recorded: false, batchStarts: [0], tricky: [] };
      fresh = new Set();
      renderLevel();
      refreshGoal();
      screen.load(makeBatch(FIRST_BATCH_WORDS, null), { endless: true, active: activeKeys() });
    }

    // Saves the adaptive run as one session. Returns the summary, or null when there was too little to save.
    function recordRun() {
      const session = screen.session;
      if (!run || run.recorded || !session || !session.started) return null;
      run.recorded = true;
      // A run left while paused ends at the moment it paused, so the break does not count.
      if (!session.finished) session.finish(session.pausedAt != null ? session.pausedAt : performance.now());
      const summary = session.summary();
      if (summary.ms < MIN_RUN_MS && session.correct < MIN_RUN_CHARS) return null;
      const samples = session.takeSamples();
      const confusions = session.takeConfusions();
      if (samples.length || confusions.length) KS.update(st, samples, confusions);
      plan = S.plan();
      TL.store.recordSession({ kind: "practice", mode: "adaptive", letters: plan.count, label: `Level ${S.levelOf(plan)}`, bestKey: "practice", summary });
      TL.account.syncSoon();
      return summary;
    }

    // Leaves the run (another mode, restart, leaving the page): the work so far is kept, with no results screen.
    function abandonRun() {
      if (s.mode === "adaptive" && run && !run.recorded) {
        const session = screen.session;
        if (session && session.started) recordRun();
      }
    }

    function finishAdaptive(session) {
      const summary = recordRun();
      if (!summary) { startAdaptive(); return; }
      refreshGoal();
      const extras = [];
      if (TL.store.todayActiveMs() >= TL.store.STREAK_MS) extras.push(S.banner("good", "Streak day done.", `You have typed ${TL.ui.fmt.clock(TL.store.todayActiveMs())} today. That is a ${TL.store.streak()}-day streak.`));
      for (const g of run.levelsGained) extras.push(S.banner("good", `Level ${g.level} reached.`, `${g.letters.join(", ")} unlocked during this run.`));
      if (!run.levelsGained.length && plan.focus) {
        const row = plan.rows.find((r) => r.ch === plan.focus);
        extras.push(S.banner("warn", `Focus letter: ${plan.focus.toUpperCase()}.`,
          row && row.wpm ? `It is at ${Math.round(row.wpm)} WPM and the target is ${s.targetWpm}. It appears more often in your next run.` : "It appears more often in your next run."));
      }
      for (const b of S.newBadges()) extras.push(S.banner("good", `Achievement unlocked: ${b.title}.`, b.desc));
      extras.push(S.card("Your letters", S.keyTable(plan)));
      extras.push(S.card("Forecast", h("p", null, S.forecast())));
      const node = TL.ui.results.render({
        title: "Run complete", subtitle: `Level ${S.levelOf(plan)} of ${S.MAX_LEVEL}, ${plan.count} letters in play`, summary, extras,
        actions: [
          { label: "Keep practising", primary: true, onClick: startAdaptive },
          { label: "See my progress", onClick: () => { location.hash = "#/stats"; } },
        ],
      });
      screen.showResults(node, `Run complete. ${Math.round(summary.netWpm)} words per minute, ${Math.round(summary.accuracy)} percent accuracy.`);
    }

    // ---- speed tests -------------------------------------------------------------------------

    function startTest(sameText) {
      const c = testConfig();
      if (!sameText || !finiteText) finiteText = testText();
      const active = c.fixed ? null : new Set([...S.order, " ", ...(c.punct ? ",.?!;" : ""), ...(c.numbers ? "0123456789" : "")]);
      screen.load(finiteText, { limitMs: c.mode === "time" ? c.amount * 1000 : null, active });
    }

    function finishTest(session) {
      const c = testConfig();
      const summary = session.summary();
      S.learn(session);
      const r = TL.store.recordSession({ kind: "test", mode: c.mode, label: c.label, bestKey: c.key, summary });
      TL.account.syncSoon();
      refreshGoal();
      const record = st.bests[c.key];
      const extras = [];
      if (TL.store.todayActiveMs() >= TL.store.STREAK_MS) extras.push(S.banner("good", "Streak day done.", `You have typed ${TL.ui.fmt.clock(TL.store.todayActiveMs())} today. That is a ${TL.store.streak()}-day streak.`));
      if (r.isBest) extras.push(S.banner("good", "New personal best for this test.", `${Math.round(record.wpm)} WPM at ${Math.round(record.acc)}% accuracy.`));
      else if (record) extras.push(S.card("Personal best for this test", h("p", null, `${Math.round(record.wpm)} WPM at ${Math.round(record.acc)}% accuracy.`)));
      if (summary.accuracy < 90) extras.push(S.banner("warn", "Accuracy under 90%.", "Slow down a little. Clean typing is the fastest way to get quicker."));
      for (const b of S.newBadges()) extras.push(S.banner("good", `Achievement unlocked: ${b.title}.`, b.desc));
      const node = TL.ui.results.render({
        title: "Test complete", subtitle: c.label, summary, extras,
        actions: [
          { label: "New test", primary: true, onClick: () => startTest(false) },
          { label: "Same text again", onClick: () => startTest(true) },
          { label: "Adaptive practice", onClick: () => setMode("adaptive") },
        ],
      });
      screen.showResults(node, `Test complete. ${Math.round(summary.netWpm)} words per minute, ${Math.round(summary.accuracy)} percent accuracy.`);
    }

    // ---- mode bar ----------------------------------------------------------------------------

    function refreshGoal() {
      goalHost.textContent = "";
      goalBox = S.goal();
      streakToasted = false;
      goalHost.append(goalBox);
    }

    // Once a second the streak box adds the typing time of the run that is going on, so you see the
    // day fill up while you type. The moment it reaches five minutes a message floats over the text
    // (it takes no focus and never stops the clock).
    function tickGoal() {
      if (!goalBox) return;
      const session = screen.session;
      const live = session && session.started && !session.finished && !(run && run.recorded);
      const extra = live ? session.activeMs : 0;
      const base = TL.store.todayActiveMs();
      goalBox.update(extra);
      if (extra && !streakToasted && base < TL.store.STREAK_MS && base + extra >= TL.store.STREAK_MS) {
        streakToasted = true;
        screen.toast("Streak day complete! 5 minutes typed", "good");
        if (s.sound) TL.ui.sound.play("level", s.volume);
      }
    }
    const goalTimer = setInterval(tickGoal, 1000);

    function setMode(mode) {
      abandonRun();
      s.mode = mode;
      TL.store.save();
      renderBar();
      begin();
    }

    function begin() {
      finishBtn.hidden = s.mode !== "adaptive";
      help.textContent = MODE_HELP[s.mode];
      renderLevel();
      if (s.mode === "adaptive") startAdaptive();
      else { refreshGoal(); startTest(false); }
    }

    const radio = (value, text, on, pick) => h("button", {
      class: "seg" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": String(on), onclick: () => pick(value),
    }, text);
    // After a mouse click the checkbox lets go of the keyboard, so typing carries on straight away.
    const check = (label, on, change) => h("label", { class: "check" },
      h("input", {
        type: "checkbox", checked: on ? "" : null,
        onclick: (e) => { if (e.detail > 0) e.target.blur(); },
        onchange: (e) => change(e.target.checked),
      }), label);

    // A speed test has a fixed text, so changing its options starts a new one.
    function optionsChanged() {
      abandonRun();
      TL.store.save();
      renderBar();
      begin();
    }

    // The adaptive stream just reads the options when it makes the next words, so the run goes on untouched.
    function streamOptionChanged() {
      TL.store.save();
      screen.keyboard.setActive(activeKeys());
    }

    function renderBar() {
      bar.textContent = "";
      bar.append(h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Practice mode", "data-tour": "modes" },
        ...MODES.map(([v, t]) => radio(v, t, s.mode === v, setMode))));
      if (s.mode === "adaptive") {
        bar.append(h("div", { class: "checks", "aria-label": "Extras for the stream of words" },
          check("Capitals", s.capitals, (v) => { s.capitals = v; streamOptionChanged(); }),
          check("Punctuation", s.punctuation, (v) => { s.punctuation = v; streamOptionChanged(); }),
          check("Numbers", s.numbers, (v) => { s.numbers = v; streamOptionChanged(); }),
          check("Symbols", s.symbols, (v) => { s.symbols = v; streamOptionChanged(); })));
        return;
      }
      const [field, values, label] = AMOUNTS[s.mode];
      bar.append(h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Length" },
        ...values.map((v) => radio(v, label(v), s[field] === v, (x) => { s[field] = x; optionsChanged(); }))));
      if (s.mode === "code") {
        bar.append(h("label", { class: "field-inline" }, "Language",
          h("select", { onchange: (e) => { s.testLang = e.target.value; e.target.blur(); optionsChanged(); } },
            ...LANGS.map(([v, t]) => h("option", { value: v, selected: s.testLang === v ? "" : null }, t)))));
      } else if (s.mode !== "sentences") {
        bar.append(h("div", { class: "checks" },
          check("Punctuation and capitals", s.testPunctuation, (v) => { s.testPunctuation = v; optionsChanged(); }),
          check("Numbers", s.testNumbers, (v) => { s.testNumbers = v; optionsChanged(); })));
      }
    }

    // ---- start-up and clean-up ---------------------------------------------------------------

    function onFinish(session) {
      if (s.mode === "adaptive") finishAdaptive(session);
      else finishTest(session);
    }

    // Closing the tab mid-run must not lose the run.
    const onHide = () => { abandonRun(); TL.store.save(); };
    root.addEventListener("pagehide", onHide);

    const screen = TL.ui.typing.create(host, {
      settings: s, onFinish, barValue,
      onKey: () => { const x = screen.session; if (x && x.pendingSamples() >= FLUSH_SAMPLES) flush(); },
      // When only the last space of the batch is left, the next batch is added: typing never waits for words.
      refill: (session) => {
        if (s.mode !== "adaptive" || !run || session.n - session.pos > 1) return null;
        const next = makeBatch(BATCH_WORDS, session);
        run.batchStarts.push(session.n);
        renderLevel();
        return next;
      },
      onRestart: () => {
        if (s.mode === "adaptive") { abandonRun(); startAdaptive(); } else startTest(true);
      },
      onNew: null,
      toolbarExtra: [finishBtn],
    });

    // On a desktop screen the page is one fixed view with no scrolling: the typing area (numbers, text,
    // keyboard and hands) takes the left, and the controls, level and streak sit in a column on the right.
    main.classList.add("page-practice");
    document.body.classList.add("fit-screen");
    main.append(
      h("div", { class: "pp-grid" },
        h("div", { class: "pp-main" }, host),
        h("aside", { class: "pp-side", "aria-label": "Mode, level and streak" },
          h("div", { class: "pp-head" },
            h("h1", null, "Practice"),
            h("p", { class: "lead" }, "Pick a mode and type. A wrong key never moves on until you type the right one.")),
          goalHost,
          h("section", { class: "pp-card pp-modes" }, bar, help),
          levelBox)));
    renderBar();
    begin();

    return () => {
      main.classList.remove("page-practice");
      document.body.classList.remove("fit-screen");
      abandonRun();
      clearInterval(goalTimer);
      root.removeEventListener("pagehide", onHide);
      screen.destroy();
    };
  }

  TL.pages = TL.pages || {};
  TL.pages.practice = { title: "Practice", mount };
})(window);
