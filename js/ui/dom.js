/* TypeLab UI helpers: element builders, number formatting, one shared tooltip and key sounds.
   Text is always inserted with textContent, never as HTML, so stored data cannot inject markup. */
(function (root) {
  "use strict";

  const TL = (root.TL = root.TL || {});
  const ui = (TL.ui = TL.ui || {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  function fill(el, attrs, children) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const h = (tag, attrs, ...children) => fill(document.createElement(tag), attrs, children);
  const svg = (tag, attrs, ...children) => fill(document.createElementNS(SVG_NS, tag), attrs, children);
  const clear = (el) => { el.textContent = ""; return el; };

  const fmt = {
    num: (v, digits = 0) => (Number.isFinite(v) ? v.toFixed(digits) : "-"),
    pct: (v) => (Number.isFinite(v) ? Math.round(v) + "%" : "-"),
    clock(ms) {
      const s = Math.max(0, Math.round(ms / 1000));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    },
    minutes(ms) {
      const m = ms / 60000;
      return m < 1 ? (ms ? "<1 min" : "0 min") : m < 90 ? Math.round(m) + " min" : (m / 60).toFixed(1) + " h";
    },
    date: (ts) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    dateTime: (ts) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  };

  // A stat tile: small label above a large value, with an optional note below.
  function tile(label, value, note, cls) {
    return h("div", { class: "tile" + (cls ? " " + cls : "") },
      h("span", { class: "tile-l" }, label),
      h("span", { class: "tile-v" }, value),
      note ? h("span", { class: "tile-n" }, note) : null);
  }

  // One tooltip shared by every chart and heat cell. rows: [[name, value, swatchClass?], ...]
  let tipEl = null;
  const tip = {
    show(title, rows, x, y) {
      if (!tipEl) {
        tipEl = h("div", { class: "tip", role: "tooltip", hidden: true });
        document.body.append(tipEl);
      }
      clear(tipEl);
      if (title) tipEl.append(h("div", { class: "tip-t" }, title));
      for (const [name, value, swatch] of rows) {
        tipEl.append(h("div", { class: "tip-r" },
          swatch ? h("span", { class: "tip-key " + swatch, "aria-hidden": "true" }) : null,
          h("strong", null, value),
          h("span", null, name)));
      }
      tipEl.hidden = false;
      const w = tipEl.offsetWidth;
      const vw = document.documentElement.clientWidth;
      tipEl.style.left = Math.max(8, Math.min(x + 14, vw - w - 8)) + "px";
      tipEl.style.top = Math.max(8, y - tipEl.offsetHeight - 12) + "px";
    },
    hide() { if (tipEl) tipEl.hidden = true; },
    // Shows the tip on hover and on keyboard focus for one element. The tip is position: fixed,
    // so it works in viewport coordinates. build() returns { title, rows } or null.
    attach(el, build) {
      const show = (e) => {
        const b = build();
        if (!b) return;
        if (e.type === "focus") {
          const r = el.getBoundingClientRect();
          tip.show(b.title, b.rows, r.left + r.width / 2, r.top);
        } else tip.show(b.title, b.rows, e.clientX, e.clientY);
      };
      el.addEventListener("pointermove", show);
      el.addEventListener("focus", show);
      el.addEventListener("pointerleave", tip.hide);
      el.addEventListener("blur", tip.hide);
    },
  };

  Object.assign(ui, { h, svg, clear, fmt, tile, tip });
})(window);
