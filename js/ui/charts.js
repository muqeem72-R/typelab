/* TypeLab charts: a line chart, a bar list and a practice calendar, drawn without a library.
   All colour comes from CSS classes (see the chart section of style.css). Every chart has
   a hover/keyboard tooltip and a table view, so no value is available only through colour. */
(function (root) {
  "use strict";

  const { h, svg, tip } = root.TL.ui;

  function niceTicks(min, max, count) {
    const range = max - min || 1;
    const raw = range / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const f = raw / pow;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
    const out = [];
    for (let v = Math.floor(min / step) * step; v < max + step * 0.999; v += step) out.push(+v.toFixed(6));
    return out;
  }

  const path = (pts) => pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");

  // series: [{ name, cls: "s1", points: [{ x, y }] }], all sharing the same x values.
  // marks: [{ x }] draws a small cross on the baseline (used for seconds with mistakes).
  function line({ series, xLabel = "", yLabel = "", fmtX = String, fmtY = String, yMin = 0, ref, marks, markLabel = "", extraRows, ariaLabel = "" }) {
    const plot = h("div", { class: "chart-plot" });
    const xs = series[0].points.map((p) => p.x);
    const legend = series.length > 1 || (marks && marks.length)
      ? h("ul", { class: "chart-legend", "aria-label": "Legend" },
          ...series.map((s) => h("li", null, h("span", { class: "key-line " + s.cls, "aria-hidden": "true" }), s.name)),
          marks && marks.length ? h("li", null, h("span", { class: "key-x", "aria-hidden": "true" }, "×"), markLabel) : null)
      : null;

    const table = h("details", { class: "chart-table" },
      h("summary", null, "View data as a table"),
      h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, h("th", { scope: "col" }, xLabel || "#"), ...series.map((s) => h("th", { scope: "col" }, s.name)))),
        h("tbody", null, ...xs.map((x, i) => h("tr", null, h("th", { scope: "row" }, fmtX(x)), ...series.map((s) => h("td", null, fmtY(s.points[i].y)))))))));

    const fig = h("figure", { class: "chart" }, plot, legend, table);
    let drawnWidth = 0;

    function draw() {
      const W = Math.max(260, Math.floor(plot.clientWidth));
      if (W === drawnWidth) return;
      drawnWidth = W;
      const H = Math.round(Math.min(300, Math.max(190, W * 0.42)));
      const m = { l: 42, r: 16, t: 22, b: xLabel ? 44 : 30 };
      const iw = W - m.l - m.r;
      const ih = H - m.t - m.b;

      const allY = series.flatMap((s) => s.points.map((p) => p.y)).concat(ref ? [ref.y] : []);
      const yTicks = niceTicks(yMin, Math.max(...allY, yMin + 1), 4);
      const y0 = yTicks[0];
      const y1 = yTicks[yTicks.length - 1];
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs) === xMin ? xMin + 1 : Math.max(...xs);
      const px = (x) => m.l + ((x - xMin) / (xMax - xMin)) * iw;
      const py = (y) => m.t + ih - ((y - y0) / (y1 - y0)) * ih;
      const xTicks = niceTicks(xMin, xMax, Math.max(2, Math.min(6, Math.floor(iw / 70)))).filter((v) => v >= xMin && v <= xMax);

      const root = svg("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: "0", "aria-label": ariaLabel });
      for (const v of yTicks) {
        root.append(svg("line", { class: v === y0 ? "axis" : "grid", x1: m.l, x2: W - m.r, y1: py(v), y2: py(v) }));
        root.append(svg("text", { class: "tick", x: m.l - 8, y: py(v) + 4, "text-anchor": "end" }, fmtY(v)));
      }
      for (const v of xTicks) root.append(svg("text", { class: "tick", x: px(v), y: H - m.b + 17, "text-anchor": "middle" }, fmtX(v)));
      if (yLabel) root.append(svg("text", { class: "ax-title", x: 4, y: 11 }, yLabel));
      if (xLabel) root.append(svg("text", { class: "ax-title", x: m.l + iw / 2, y: H - 6, "text-anchor": "middle" }, xLabel));

      if (ref) {
        root.append(svg("line", { class: "ref", x1: m.l, x2: W - m.r, y1: py(ref.y), y2: py(ref.y) }));
        root.append(svg("text", { class: "ref-l", x: W - m.r, y: py(ref.y) - 6, "text-anchor": "end" }, ref.label));
      }
      if (series.length === 1) {
        const pts = series[0].points.map((p) => [px(p.x), py(p.y)]);
        root.append(svg("path", { class: "area " + series[0].cls, d: path(pts) + ` L${pts[pts.length - 1][0].toFixed(1)} ${py(y0)} L${pts[0][0].toFixed(1)} ${py(y0)} Z` }));
      }
      for (const s of series) {
        const pts = s.points.map((p) => [px(p.x), py(p.y)]);
        root.append(svg("path", { class: "ln " + s.cls, d: path(pts) }));
        const show = pts.length <= 40 ? pts : [pts[pts.length - 1]];
        for (const [x, y] of show) root.append(svg("circle", { class: "dot " + s.cls, cx: x, cy: y, r: 4 }));
      }
      if (series.length === 1) {
        const last = series[0].points[series[0].points.length - 1];
        const lx = px(last.x);
        root.append(svg("text", { class: "val", x: Math.min(lx, W - m.r), y: py(last.y) - 11, "text-anchor": lx > W - 40 ? "end" : "middle" }, fmtY(last.y)));
      }
      for (const mk of marks || []) {
        const x = px(mk.x);
        const y = py(y0) - 9;
        root.append(svg("path", { class: "xmark", d: `M${x - 3.5} ${y - 3.5} L${x + 3.5} ${y + 3.5} M${x + 3.5} ${y - 3.5} L${x - 3.5} ${y + 3.5}` }));
      }

      const cross = svg("line", { class: "cross", y1: m.t, y2: m.t + ih, visibility: "hidden" });
      const hit = svg("rect", { class: "hit", x: m.l, y: m.t, width: iw, height: ih });
      root.append(cross, hit);

      let index = -1;
      const focusDots = [];
      const showAt = (i) => {
        i = Math.max(0, Math.min(xs.length - 1, i));
        index = i;
        const x = px(xs[i]);
        cross.setAttribute("x1", x);
        cross.setAttribute("x2", x);
        cross.setAttribute("visibility", "visible");
        for (const d of focusDots.splice(0)) d.remove();
        for (const s of series) {
          const d = svg("circle", { class: "dot hot " + s.cls, cx: x, cy: py(s.points[i].y), r: 5 });
          focusDots.push(d);
          root.insertBefore(d, cross);
        }
        const r = root.getBoundingClientRect();
        const rows = series.map((s) => [s.name, fmtY(s.points[i].y), s.cls]);
        if (extraRows) rows.push(...extraRows(i));
        tip.show(fmtX(xs[i]), rows, r.left + x, r.top + py(series[0].points[i].y));
      };
      const hide = () => { cross.setAttribute("visibility", "hidden"); for (const d of focusDots.splice(0)) d.remove(); tip.hide(); index = -1; };
      const nearest = (clientX) => {
        const r = root.getBoundingClientRect();
        const x = ((clientX - r.left) / r.width) * W;
        let best = 0;
        for (let i = 1; i < xs.length; i++) if (Math.abs(px(xs[i]) - x) < Math.abs(px(xs[best]) - x)) best = i;
        return best;
      };
      hit.addEventListener("pointermove", (e) => showAt(nearest(e.clientX)));
      hit.addEventListener("pointerleave", hide);
      root.addEventListener("focus", () => showAt(xs.length - 1));
      root.addEventListener("blur", hide);
      root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") { showAt(index + 1); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { showAt(index < 0 ? xs.length - 1 : index - 1); e.preventDefault(); }
        else if (e.key === "Home") { showAt(0); e.preventDefault(); }
        else if (e.key === "End") { showAt(xs.length - 1); e.preventDefault(); }
        else if (e.key === "Escape") hide();
      });

      plot.textContent = "";
      plot.append(root);
    }

    if (typeof ResizeObserver === "function") new ResizeObserver(draw).observe(plot);
    else requestAnimationFrame(draw);
    return fig;
  }

  // Horizontal bars: rows [{ label, value, text, title, rows }]. Value 0..max fills the track.
  function bars(rows, { max, unit = "", wide = false } = {}) {
    const top = max || Math.max(1, ...rows.map((r) => r.value || 0));
    return h("div", { class: "bars" + (wide ? " wide" : "") }, ...rows.map((r) => {
      const fillEl = h("span", { class: "bar-fill" });
      fillEl.style.width = Math.max(0, Math.min(100, ((r.value || 0) / top) * 100)) + "%";
      const row = h("div", { class: "bar-row", tabindex: "0" },
        h("span", { class: "bar-l" }, r.label),
        h("span", { class: "bar-track" }, fillEl),
        h("span", { class: "bar-v" }, r.text != null ? r.text : (r.value == null ? "-" : Math.round(r.value) + unit)));
      tip.attach(row, () => ({ title: r.title || r.label, rows: r.rows || [] }));
      return row;
    }));
  }

  // A GitHub-style grid of the last `weeks` weeks (Monday first), showing time spent typing each day.
  // Level 3 means the day reached `streakMs` (a streak day) and level 4 means three times that.
  function calendar(days, { weeks = 16, streakMs, dayKey }) {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (weeks - 1) * 7 - dow);
    const cells = [];
    const minutes = (ms) => (ms < 60000 ? "under a minute" : Math.round(ms / 60000) + " min");
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const future = d > today;
      const rec = days[dayKey(d)];
      const ms = rec ? (Number.isFinite(rec.act) ? rec.act : rec.ms) : 0;
      const level = !ms ? 0 : ms >= streakMs * 3 ? 4 : ms >= streakMs ? 3 : ms >= streakMs * 0.4 ? 2 : 1;
      const when = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      const label = rec ? `${when}: ${minutes(ms)} typed${ms >= streakMs ? ", a streak day" : ""}` : `${when}: no typing`;
      const cell = h("span", { class: "cal-cell" + (future ? " future" : ""), "data-level": level, title: future ? null : label, "aria-label": future ? null : label });
      if (!future) {
        tip.attach(cell, () => ({
          title: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
          rows: [["typed", rec ? minutes(ms) : "nothing"], ["streak day", ms >= streakMs ? "yes" : "not reached"]],
        }));
      }
      cells.push(cell);
    }
    return h("div", { class: "calendar" },
      h("div", { class: "cal-grid", role: "img", "aria-label": `Typing calendar for the last ${weeks} weeks` }, ...cells),
      h("div", { class: "cal-key", "aria-hidden": "true" }, "Less", ...[0, 1, 2, 3, 4].map((l) => h("span", { class: "cal-cell", "data-level": l })), "More (the third square is a streak day)"));
  }

  root.TL.ui.charts = { line, bars, calendar, niceTicks };
})(window);
