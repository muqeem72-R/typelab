/* TypeLab virtual keyboard and hands overlay.
   Built from the layout data. Colours come from CSS classes (f-lp, f-ri ...), never from
   inline styles, so the page stays within its content security policy. */
(function (root) {
  "use strict";

  const { h } = root.TL.ui;
  const L = root.TL.layout;

  const FINGER_LABEL = { lp: "Pinky", lr: "Ring", lm: "Middle", li: "Index", th: "Thumb" };

  // The colour key under the keyboard, so identity never depends on colour alone.
  function legend() {
    return h("ul", { class: "kb-legend", "aria-label": "Finger colours" },
      ...Object.entries(FINGER_LABEL).map(([id, name]) =>
        h("li", null, h("span", { class: "swatch f-" + id, "aria-hidden": "true" }), name)));
  }

  function create({ showHands = true } = {}) {
    const hands = root.TL.ui.hands.create();
    const kb = h("div", { class: "kb", "data-kind": "guide", "aria-hidden": "true" });
    const keys = {};

    for (const row of L.ROWS) {
      const r = h("div", { class: "kb-row" });
      for (const k of row) {
        if (k.kind === "pad") { r.append(h("div", { class: "key pad", "data-w": k.w })); continue; }
        let inner;
        if (k.kind === "mod") inner = [h("span", { class: "k-mod" }, k.base)];
        else if (k.kind === "space") inner = [];
        else if (/[a-z]/.test(k.base)) inner = [h("span", { class: "k-base" }, k.shift)];
        else inner = [h("span", { class: "k-top" }, k.shift), h("span", { class: "k-base" }, k.base)];
        const el = h("div", {
          class: `key f-${k.finger} ${k.kind}` + (L.BUMP_CODES.includes(k.code) ? " bump" : ""),
          "data-w": k.w, "data-code": k.code,
        }, ...inner);
        keys[k.code] = { el, key: k };
        r.append(el);
      }
      kb.append(r);
    }

    // The hands lie on top of the keyboard (see keyboard.css). While keys are being pressed they are very faint, and a
    // moment after the last key they come back a little stronger. They are never solid, so the keys show through.
    const stage = h("div", { class: "kb-stage" }, kb, showHands ? hands.el : null);
    const wrap = h("div", { class: "kb-wrap" }, stage, legend());
    let flashTimer = new Map();
    let restTimer = null;
    const REST_AFTER_MS = 1300;
    function typing() {
      wrap.classList.add("typing");
      clearTimeout(restTimer);
      restTimer = setTimeout(() => wrap.classList.remove("typing"), REST_AFTER_MS);
    }

    return {
      el: wrap,

      // Lights the key for `ch`, plus the Shift key and fingers it needs. Pass null to clear.
      target(ch) {
        for (const k of Object.values(keys)) k.el.classList.remove("next", "next-shift");
        const d = ch == null ? null : L.describe(ch);
        if (!d) { hands.show([]); return; }
        keys[d.key.code].el.classList.add("next");
        if (d.shiftKey) keys[d.shiftKey.code].el.classList.add("next-shift");
        hands.show(d.fingers);
      },

      flash(code, ok) {
        const k = keys[code];
        if (!k) return;
        typing();
        const cls = ok ? "hit" : "miss";
        k.el.classList.remove("hit", "miss");
        void k.el.offsetWidth;   // restart the animation if the same key is hit twice
        k.el.classList.add(cls);
        clearTimeout(flashTimer.get(code));
        flashTimer.set(code, setTimeout(() => k.el.classList.remove(cls), 220));
      },

      // chars: Set of characters still locked in (null = everything is available).
      setActive(chars) {
        for (const { el, key } of Object.values(keys)) {
          if (key.kind !== "char") continue;
          el.classList.toggle("dim", !!chars && !(chars.has(key.base) || (key.shift && chars.has(key.shift))));
        }
      },

      // levels: { code: { level: 0-5, label } }. kind: "speed" or "error" picks the colour ramp.
      heat(levels, kind) {
        kb.dataset.kind = levels ? kind : "guide";
        for (const [code, { el }] of Object.entries(keys)) {
          const v = levels && levels[code];
          if (v) { el.dataset.heat = v.level; el.title = v.label; }
          else { delete el.dataset.heat; el.removeAttribute("title"); }
        }
      },

      set hidden(v) { wrap.hidden = v; },
      keys,
    };
  }

  root.TL.ui.keyboard = { create, legend };
})(window);
