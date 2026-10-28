/* TypeLab results card: the big speed number, the supporting figures, the per-second chart
   and whatever extra blocks the page adds (unlocked letter, stars, personal best ...). */
(function (root) {
  "use strict";

  const { h, fmt, tile, charts } = root.TL.ui;

  // actions: [{ label, primary, onClick }]. Enter runs the first primary action.
  function render({ title, subtitle, summary, extras = [], actions = [] }) {
    const s = summary;

    let chart = h("p", { class: "muted" }, "This session was too short to draw a chart.");
    if (s.series.length >= 3) {
      const perSecond = s.series;
      chart = charts.line({
        series: [
          { name: "Net speed", cls: "s1", points: perSecond.map((p) => ({ x: p.s, y: p.wpm })) },
          { name: "Raw speed", cls: "s2", points: perSecond.map((p) => ({ x: p.s, y: p.raw })) },
        ],
        marks: perSecond.filter((p) => p.errors > 0).map((p) => ({ x: p.s })),
        markLabel: "Mistake in that second",
        xLabel: "Seconds",
        yLabel: "WPM",
        fmtX: (v) => v + "s",
        fmtY: (v) => String(Math.round(v)),
        extraRows: (i) => (perSecond[i].errors ? [["mistakes this second", String(perSecond[i].errors)]] : []),
        ariaLabel: `Typing speed over ${Math.round(s.ms / 1000)} seconds. Final net speed ${Math.round(s.netWpm)} words per minute.`,
      });
    }

    const heading = h("h2", { tabindex: "-1" }, title);
    const buttons = actions.map((a) => h("button", { class: "btn" + (a.primary ? " primary" : ""), type: "button", onclick: a.onClick }, a.label));
    const first = actions.find((a) => a.primary);

    const el = h("article", { class: "result" },
      h("header", { class: "res-head" }, heading, subtitle ? h("p", { class: "muted" }, subtitle) : null),
      h("div", { class: "res-hero" },
        h("span", { class: "res-num" }, fmt.num(s.netWpm, 0)),
        h("span", { class: "res-unit" }, "WPM"),
        h("p", { class: "muted" }, `Net speed. Raw speed was ${fmt.num(s.rawWpm, 0)} WPM.`)),
      h("div", { class: "tiles" },
        tile("Accuracy", fmt.num(s.accuracy, 1) + "%"),
        tile("Mistakes", String(s.errors)),
        tile("Consistency", s.consistency == null ? "-" : s.consistency + "%"),
        tile("Time", fmt.clock(s.ms)),
        tile("Characters", String(s.chars))),
      h("div", { class: "card" }, h("h3", { class: "sub" }, "Speed over time"), chart),
      ...extras,
      h("div", { class: "res-actions" }, ...buttons, first ? h("span", { class: "muted" }, h("kbd", null, "Enter"), " for the main button") : null));

    const onKey = (e) => {
      if (!el.isConnected) { document.removeEventListener("keydown", onKey); return; }
      if (e.key === "Enter" && first && !e.repeat && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.target.tagName)) {
        e.preventDefault();
        first.onClick();
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => heading.focus({ preventScroll: true }), 0);
    return el;
  }

  root.TL.ui.results = { render };
})(window);
