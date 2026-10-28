/* TypeLab page: statistics. The filters scope the session charts; the key data below them is
   all-time, because per-key speed is a running figure and not a list of sessions. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt, tile, charts } = TL.ui;
  const S = TL.shared;
  const L = TL.layout;
  const M = TL.metrics;

  const KINDS = [["all", "All sessions"], ["practice", "Adaptive practice"], ["test", "Speed tests"], ["course", "Course"]];
  const RANGES = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "All time"]];
  const DAY = 86400000;

  const mean = (xs) => (xs.length ? M.mean(xs) : null);
  const KINDLABEL = { practice: "Practice", test: "Test", course: "Course" };

  // 1-5 steps for a ratio where 1 is "at target".
  const speedLevel = (r) => (r >= 1 ? 5 : r >= 0.9 ? 4 : r >= 0.7 ? 3 : r >= 0.4 ? 2 : 1);
  // 1-5 steps for a mistake rate.
  const errorLevel = (e) => (e >= 0.15 ? 5 : e >= 0.1 ? 4 : e >= 0.06 ? 3 : e >= 0.03 ? 2 : 1);

  function mount(main) {
    const st = TL.store.load();
    const target = st.settings.targetWpm;
    const view = { kind: "all", range: "30", heat: "speed" };
    const body = h("div");

    const select = (label, options, key) => h("label", { class: "field-inline" }, label,
      h("select", { onchange: (e) => { view[key] = e.target.value; draw(); } },
        ...options.map(([v, t]) => h("option", { value: v, selected: view[key] === v ? "" : null }, t))));

    function sessions() {
      const since = view.range === "all" ? 0 : Date.now() - Number(view.range) * DAY;
      return st.sessions.filter((x) => (view.kind === "all" || x.kind === view.kind) && x.ts >= since);
    }

    function sessionCharts(list) {
      if (list.length < 2) {
        return h("section", { class: "card" }, h("h3", { class: "sub" }, "Progress"), h("p", { class: "muted" }, "Charts appear after two sessions in this view. Finish a few practice sessions, tests or lessons."));
      }
      const xs = list.map((_, i) => i + 1);
      const when = (i) => [["session", `${KINDLABEL[list[i].kind] || list[i].kind}, ${fmt.dateTime(list[i].ts)}`]];
      const minAcc = Math.min(...list.map((x) => x.acc));
      return h("div", { class: "grid two" },
        h("section", { class: "card" }, h("h3", { class: "sub" }, "Speed per session"),
          charts.line({
            series: [{ name: "Net speed", cls: "s1", points: list.map((x, i) => ({ x: xs[i], y: x.wpm })) }],
            ref: view.kind === "practice" || view.kind === "all" ? { y: target, label: `Target ${target}` } : null,
            xLabel: "Session", yLabel: "WPM", fmtX: (v) => "#" + v, fmtY: (v) => String(Math.round(v)),
            extraRows: when, ariaLabel: `Net typing speed over ${list.length} sessions. Latest ${Math.round(list[list.length - 1].wpm)} words per minute.`,
          })),
        h("section", { class: "card" }, h("h3", { class: "sub" }, "Accuracy per session"),
          charts.line({
            series: [{ name: "Accuracy", cls: "s1", points: list.map((x, i) => ({ x: xs[i], y: x.acc })) }],
            yMin: Math.max(0, Math.floor((minAcc - 4) / 10) * 10),
            xLabel: "Session", yLabel: "%", fmtX: (v) => "#" + v, fmtY: (v) => Math.round(v) + "%",
            extraRows: when, ariaLabel: `Accuracy over ${list.length} sessions. Latest ${Math.round(list[list.length - 1].acc)} percent.`,
          })));
    }

    function heatKeyboard() {
      const kb = TL.ui.keyboard.create({ showHands: false });
      const levels = {};
      for (const k of L.ROWS.flat()) {
        if (k.kind !== "char") continue;
        const stat = st.keys[k.base];
        if (!stat || stat.n < 5) continue;
        if (view.heat === "speed") {
          const wpm = M.speedFromMs(stat.time);
          levels[k.code] = { level: speedLevel(wpm / target), label: `${k.base.toUpperCase()}: ${Math.round(wpm)} WPM` };
        } else {
          const acc = TL.keystats.accuracy(stat);
          if (acc == null) continue;
          levels[k.code] = { level: errorLevel(1 - acc), label: `${k.base.toUpperCase()}: ${Math.round((1 - acc) * 100)}% mistakes` };
        }
      }
      kb.heat(levels, view.heat);
      kb.el.querySelector(".kb-legend").remove();
      const speed = view.heat === "speed";
      const key = h("div", { class: "heat-key", "data-kind": view.heat, "aria-hidden": "true" },
        h("span", null, speed ? "Slower" : "Fewer mistakes"),
        ...[1, 2, 3, 4, 5].map((l) => h("span", { class: "hk", "data-level": l })),
        h("span", null, speed ? "Faster" : "More mistakes"));
      return h("div", null, kb.el, key);
    }

    function fingerBars() {
      const rows = [];
      for (const f of L.FINGERS.filter((x) => x.id !== "th")) {
        let n = 0, time = 0, hits = 0, total = 0;
        for (const k of L.ROWS.flat()) {
          if (k.finger !== f.id || k.kind !== "char") continue;
          const stat = st.keys[k.base];
          if (!stat || stat.n < 5) continue;
          n += stat.n; time += stat.time * stat.n;
          hits += (stat.hist.split("1").length - 1); total += stat.hist.length;
        }
        if (!n) continue;
        const wpm = M.speedFromMs(time / n);
        const acc = total ? (hits / total) * 100 : null;
        rows.push({ label: f.name, value: wpm, text: `${Math.round(wpm)} WPM` + (acc == null ? "" : `, ${Math.round(acc)}%`),
          rows: [["speed", Math.round(wpm) + " WPM"], ["accuracy", acc == null ? "-" : Math.round(acc) + "%"], ["key presses", String(n)]] });
      }
      return rows.length ? charts.bars(rows, { max: Math.max(target, ...rows.map((r) => r.value)), wide: true }) : h("p", { class: "muted" }, "Not enough key data yet.");
    }

    function letterBars() {
      const rows = S.order.filter((c) => st.keys[c] && st.keys[c].n >= 5).map((c) => {
        const stat = st.keys[c];
        const wpm = M.speedFromMs(stat.time);
        const acc = TL.keystats.accuracy(stat);
        return { label: c.toUpperCase(), value: wpm, text: `${Math.round(wpm)} WPM`,
          rows: [["speed", Math.round(wpm) + " WPM"], ["accuracy", acc == null ? "-" : Math.round(acc * 100) + "%"], ["key presses", String(stat.n)]] };
      });
      return rows.length ? charts.bars(rows, { max: Math.max(target, ...rows.map((r) => r.value)) }) : h("p", { class: "muted" }, "Type a few sessions to see your letters here.");
    }

    function listOf(title, items, empty) {
      return h("section", { class: "card" }, h("h3", { class: "sub" }, title),
        items.length ? h("ol", { class: "plain" }, ...items.map((t) => h("li", null, t))) : h("p", { class: "muted" }, empty));
    }

    function keySection() {
      const confusions = Object.entries(st.confusions).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([id, n]) => `${id[0].toUpperCase()} typed as ${id[2].toUpperCase()}: ${n} time${n === 1 ? "" : "s"}`);
      const slow = Object.entries(st.pairs).filter(([, p]) => p.n >= 6).sort((a, b) => b[1].time - a[1].time).slice(0, 8)
        .map(([id, p]) => `${id.toUpperCase()}: ${Math.round(M.speedFromMs(p.time))} WPM`);
      return h("div", null,
        h("h2", { class: "sub-h" }, "Your keys (all time)"),
        h("section", { class: "card" },
          h("div", { class: "card-head" },
            h("h3", { class: "sub" }, "Keyboard heatmap"),
            h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Heatmap" },
              ...[["speed", "Speed"], ["error", "Mistakes"]].map(([v, t]) =>
                h("button", { class: "seg" + (view.heat === v ? " on" : ""), type: "button", role: "radio", "aria-checked": String(view.heat === v), onclick: () => { view.heat = v; draw(); } }, t)))),
          heatKeyboard(),
          h("p", { class: "muted" }, view.heat === "speed"
            ? `The strongest colour means a key is at or above your target of ${target} WPM. Hover or focus a key for its exact speed. Keys with fewer than 5 presses are not coloured.`
            : "Hover or focus a key for its mistake rate. Keys with fewer than 5 presses are not coloured.")),
        h("div", { class: "grid two" },
          S.card("Speed by letter", letterBars()),
          S.card("Speed by finger", fingerBars())),
        h("div", { class: "grid two" },
          listOf("Most common mistakes", confusions, "No mistakes recorded yet."),
          listOf("Slowest letter pairs", slow, "Pairs show up after a few sessions.")));
    }

    function recent() {
      const rows = st.sessions.slice(-20).reverse();
      return S.card("Recent sessions", rows.length
        ? h("div", { class: "table-wrap" }, h("table", null,
          h("thead", null, h("tr", null, ...["When", "Type", "Detail", "WPM", "Accuracy", "Time"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", null, ...rows.map((x) => h("tr", null,
            h("th", { scope: "row" }, fmt.dateTime(x.ts)), h("td", null, KINDLABEL[x.kind] || x.kind), h("td", null, x.label),
            h("td", null, String(Math.round(x.wpm))), h("td", null, Math.round(x.acc) + "%"), h("td", null, fmt.clock(x.ms)))))))
        : h("p", { class: "muted" }, "No sessions yet."));
    }

    function draw() {
      const list = sessions();
      const totalMs = list.reduce((a, x) => a + x.ms, 0);
      body.textContent = "";
      body.append(
        h("div", { class: "tiles" },
          tile("Sessions", String(list.length)),
          tile("Practice time", fmt.minutes(totalMs)),
          tile("Average speed", list.length ? fmt.num(mean(list.map((x) => x.wpm)), 0) + " WPM" : "-"),
          tile("Best speed", list.length ? Math.round(Math.max(...list.map((x) => x.wpm))) + " WPM" : "-"),
          tile("Average accuracy", list.length ? fmt.num(mean(list.map((x) => x.acc)), 1) + "%" : "-"),
          tile("Day streak", String(TL.store.streak()), "days with 5 min of typing")),
        sessionCharts(list),
        S.card("Forecast", h("p", null, S.forecast())),
        S.card("Typing calendar",
          h("p", { class: "muted" }, "A day counts towards your streak after 5 minutes of real typing. Opening the app or typing a few words does not."),
          charts.calendar(st.days, { weeks: 16, streakMs: TL.store.STREAK_MS, dayKey: TL.store.dayKey })),
        keySection(),
        recent());
    }

    main.append(
      h("div", { class: "page-head" }, h("h1", null, "Your progress"),
        h("p", { class: "lead" }, TL.account.loggedIn()
          ? "Your rank, achievements and certificates, then the details of every session. Your sessions stay in this browser; only your name and speed numbers go to the leaderboard."
          : "Log in to get a rank and a certificate. Your sessions stay in this browser.")),
      TL.social.profileCard(),
      TL.social.leaderboardCard(),
      TL.social.achievementsCard(),
      TL.social.certificatesCard(),
      h("h2", { class: "sub-h" }, "Your sessions"),
      h("div", { class: "filters" }, select("Show", KINDS, "kind"), select("Period", RANGES, "range")),
      body);
    draw();
    return () => TL.ui.tip.hide();
  }

  TL.pages = TL.pages || {};
  TL.pages.stats = { title: "Progress", mount };
})(window);
