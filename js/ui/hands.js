/* TypeLab hands guide: two drawn human hands seen from above, resting on the keyboard.
   Each finger is its own shape so the finger to use can be coloured and lifted. The shapes are
   generated here from a few measurements (length, width, fan angle), so they are easy to tune.
   Colours come from CSS classes and variables only, so no inline styles are needed. */
(function (root) {
  "use strict";

  const { svg } = root.TL.ui;
  let uid = 0;

  const f1 = (n) => Math.round(n * 10) / 10;

  // Smooth open curve through points (Catmull-Rom turned into cubic Beziers).
  function curve(pts) {
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d;
  }

  // Outline of an upright finger whose base centre is (cx, base). The width tapers from w0 to w1,
  // swells a little at the two joints and ends in a rounded tip.
  function fingerOutline(cx, base, len, w0, w1) {
    const cap = w1 * 0.55;
    const bodyLen = len - cap;
    const half = (t) => (w0 + (w1 - w0) * t + 2.2 * (Math.exp(-(((t - 0.32) / 0.08) ** 2)) + Math.exp(-(((t - 0.66) / 0.08) ** 2)))) / 2;
    const left = [], right = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = base - t * bodyLen;
      left.push([cx - half(t), y]);
      right.push([cx + half(t), y]);
    }
    const capY = base - bodyLen;
    const tip = [];
    for (let i = 1; i < 12; i++) {
      const a = Math.PI - (Math.PI * i) / 12;
      tip.push([cx + half(1) * Math.cos(a), capY - cap * Math.sin(a)]);
    }
    const pts = [...left, ...tip, ...right.reverse()];
    return "M" + pts.map((p) => f1(p[0]) + " " + f1(p[1])).join("L") + "Z";
  }

  // One finger: skin, a soft highlight, two joint creases and a nail, drawn upright in its own
  // frame and then fanned out by `rot` degrees around its base.
  function finger(spec, id) {
    const { cx, base, len, w0, w1, rot } = spec;
    const cap = w1 * 0.55;
    const bodyLen = len - cap;
    const yAt = (t) => base - t * bodyLen;
    const crease = (t) => {
      const w = (w0 + (w1 - w0) * t) * 0.3;
      const y = yAt(t);
      return svg("path", { class: "crease", d: `M${f1(cx - w)} ${f1(y)}Q${f1(cx)} ${f1(y + 2.4)} ${f1(cx + w)} ${f1(y)}` });
    };
    const nailW = w1 * 0.62;
    const nailTop = base - len + cap * 0.35;
    const inner = svg("g", { class: "fg f-" + id, "data-f": id },
      svg("path", { class: "skin", d: fingerOutline(cx, base, len, w0, w1) }),
      svg("path", { class: "shine", d: `M${f1(cx - w1 * 0.08)} ${f1(yAt(0.12))}Q${f1(cx - w1 * 0.16)} ${f1(yAt(0.55))} ${f1(cx - w1 * 0.06)} ${f1(yAt(0.9))}Q${f1(cx + w1 * 0.1)} ${f1(yAt(0.55))} ${f1(cx - w1 * 0.08)} ${f1(yAt(0.12))}Z` }),
      crease(0.34), crease(0.67),
      svg("rect", { class: "nail", x: f1(cx - nailW / 2), y: f1(nailTop), width: f1(nailW), height: f1(len * 0.2), rx: f1(nailW * 0.42) }));
    return svg("g", { transform: `rotate(${rot} ${cx} ${base})` }, inner);
  }

  // One left hand (fingers: pinky, ring, middle, index, then the thumb). The right hand is
  // the same drawing mirrored by the caller.
  function hand(ids, maskId) {
    const fingers = [
      { id: ids[0], cx: 58, base: 166, len: 86, w0: 40, w1: 31, rot: -14 },
      { id: ids[1], cx: 107, base: 148, len: 112, w0: 44, w1: 35, rot: -5 },
      { id: ids[2], cx: 156, base: 140, len: 124, w0: 46, w1: 36, rot: 0 },
      { id: ids[3], cx: 205, base: 148, len: 112, w0: 45, w1: 36, rot: 6 },
    ];
    // Its base sits inside the palm, which is drawn on top, so the thumb grows out of the hand.
    const thumb = { id: ids[4], cx: 208, base: 252, len: 118, w0: 58, w1: 44, rot: 33 };

    // The outline starts exactly where the outer edges of the pinky and index finger meet the
    // palm, so there is no step between finger and hand.
    const top = [[38, 171], [58, 156], [107, 141], [156, 133], [205, 141], [228, 152]];
    const rightSide = [[228, 152], [237, 190], [243, 232], [238, 274], [214, 312]];
    const leftSide = [[38, 171], [37, 212], [48, 258], [70, 298], [90, 312]];
    // Round the outline: across the knuckles, down the thumb side, back up the little-finger side.
    const palm = curve([...top, ...rightSide.slice(1), ...[...leftSide].reverse()]) + "Z";

    return svg("g", { mask: `url(#${maskId})` },
      finger(thumb, thumb.id),
      ...fingers.map((s) => finger(s, s.id)),
      svg("path", { class: "palm", d: palm }),
      svg("path", { class: "tendon", d: "M70 190C72 220 78 245 90 275M118 176C119 212 124 245 132 285M166 170C166 208 168 245 172 285M208 178C206 210 204 240 202 270" }),
      svg("path", { class: "edge", d: curve(leftSide) }),
      svg("path", { class: "edge", d: curve(rightSide) }));
  }

  function create() {
    const n = ++uid;
    const maskId = "tl-fade-" + n;
    const gradId = "tl-grad-" + n;
    const W = 598;   // the two hands are close together, so the index fingers meet the F and J keys when they lie on the keyboard
    const el = svg("svg", { class: "hands", viewBox: `0 0 ${W} 330`, "aria-hidden": "true", focusable: "false" },
      svg("defs", null,
        svg("linearGradient", { id: gradId, gradientUnits: "userSpaceOnUse", x1: 0, y1: 222, x2: 0, y2: 304 },
          svg("stop", { offset: 0, "stop-color": "#fff" }), svg("stop", { offset: 1, "stop-color": "#000" })),
        svg("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: 330 },
          svg("rect", { x: 0, y: 0, width: W, height: 330, fill: `url(#${gradId})` }))),
      svg("g", { transform: "translate(8 0)" }, hand(["lp", "lr", "lm", "li", "th"], maskId)),
      svg("g", { transform: `translate(${W - 8} 0) scale(-1 1)` }, hand(["rp", "rr", "rm", "ri", "th"], maskId)));
    return {
      el,
      show(fingers) {
        for (const f of el.querySelectorAll(".fg")) f.classList.toggle("on", fingers.includes(f.dataset.f));
      },
    };
  }

  root.TL.ui.hands = { create };
})(window);
