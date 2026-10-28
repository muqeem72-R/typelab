/* TypeLab theme data: the colour sets of the themes, and the maths for the Custom theme.
   Nothing here is pure white or pure black: the light themes are soft, the dark ones are dark slate or cocoa, so no theme is
   glaring or harsh. Every theme sets the same list of variables (see KEYS), so switching never leaves a colour of the last one
   behind. A "tone" (light or dark) says which family a theme belongs to: it picks the heat-map colours, the tier badges and which
   background pictures fit. This file is loaded before the page is painted (js/theme.js) and by the Node tests. */
(function (root) {
  "use strict";

  const KEYS = ["bg", "bg-alt", "surface", "text", "muted", "border", "axis", "accent", "accent-strong", "accent-ink", "accent-soft",
    "ok", "ok-soft", "bad", "bad-soft", "warn", "warn-soft", "shadow"];

  // What does not change with the palette but does change with the tone.
  const TONE = {
    light: {
      "series-1": "#2a78d6", "series-2": "#eb6834", "c-thumb": "#2a78d6", "c-index": "#eb6834", "c-middle": "#1baf7a", "c-ring": "#eda100", "c-pinky": "#e87ba4",
      sp1: "#cde2fb", sp2: "#9ec5f4", sp3: "#5598e7", sp4: "#2a78d6", sp5: "#184f95",
      spt1: "#0b0b0b", spt2: "#0b0b0b", spt3: "#0b0b0b", spt4: "#ffffff", spt5: "#ffffff",
      er1: "#fde2d6", er2: "#f9bfa5", er3: "#f08f68", er4: "#eb6834", er5: "#a8421b",
      ert1: "#0b0b0b", ert2: "#0b0b0b", ert3: "#0b0b0b", ert4: "#0b0b0b", ert5: "#ffffff",
      "color-scheme": "light",
    },
    dark: {
      "series-1": "#3987e5", "series-2": "#d95926", "c-thumb": "#3987e5", "c-index": "#d95926", "c-middle": "#199e70", "c-ring": "#c98500", "c-pinky": "#d55181",
      sp1: "#104281", sp2: "#1c5cab", sp3: "#3987e5", sp4: "#6da7ec", sp5: "#9ec5f4",
      spt1: "#ffffff", spt2: "#ffffff", spt3: "#0b0b0b", spt4: "#0b0b0b", spt5: "#0b0b0b",
      er1: "#5a2410", er2: "#8a3a1c", er3: "#d95926", er4: "#ef8a62", er5: "#f6b49a",
      ert1: "#ffffff", ert2: "#ffffff", ert3: "#0b0b0b", ert4: "#0b0b0b", ert5: "#0b0b0b",
      "color-scheme": "dark",
    },
  };

  const SHADOW_LIGHT = "0 10px 30px rgba(40, 40, 70, .12)";
  const SHADOW_DARK = "0 10px 30px rgba(0, 0, 0, .32)";

  // The ready-made themes. `swatch` is [page, card, accent] for the little preview in the picker.
  const THEMES = [
    { id: "light", name: "Light", tone: "light", vars: {
      bg: "#eceff5", "bg-alt": "#e0e5ee", surface: "#f7f9fc", text: "#1b2233", muted: "#4d5a73", border: "#cdd5e3", axis: "#b3bdd0",
      accent: "#4f46e5", "accent-strong": "#4338ca", "accent-ink": "#ffffff", "accent-soft": "#dcdcfa",
      ok: "#0f6b3e", "ok-soft": "#d7efe3", bad: "#b42318", "bad-soft": "#f8dedb", warn: "#7a4f00", "warn-soft": "#f6e8c3", shadow: SHADOW_LIGHT } },
    { id: "dark", name: "Dark", tone: "dark", vars: {
      bg: "#1b2130", "bg-alt": "#222a3b", surface: "#2a3246", text: "#e6eaf5", muted: "#a9b4cc", border: "#3c4764", axis: "#4c5878",
      accent: "#8f94ff", "accent-strong": "#a9adff", "accent-ink": "#151a28", "accent-soft": "#353d6b",
      ok: "#4ade9b", "ok-soft": "#1f3a31", bad: "#ff9088", "bad-soft": "#46262b", warn: "#f4c14a", "warn-soft": "#46391b", shadow: SHADOW_DARK } },
    { id: "gray", name: "Gray", tone: "light", vars: {
      bg: "#cfd3d9", "bg-alt": "#c3c8cf", surface: "#e4e7eb", text: "#1d2127", muted: "#454c56", border: "#aeb4bd", axis: "#99a0ab",
      accent: "#2f55c9", "accent-strong": "#2444a8", "accent-ink": "#ffffff", "accent-soft": "#c4cfee",
      ok: "#14683a", "ok-soft": "#cde4d7", bad: "#a8201a", "bad-soft": "#ecd0cd", warn: "#704400", "warn-soft": "#e8ddbd", shadow: SHADOW_LIGHT } },
    { id: "yellow", name: "Yellow", tone: "light", vars: {
      bg: "#f2e8b0", "bg-alt": "#eadd98", surface: "#faf3d0", text: "#2f2614", muted: "#5a4c28", border: "#d6c673", axis: "#c3b158",
      accent: "#8f6200", "accent-strong": "#734d00", "accent-ink": "#ffffff", "accent-soft": "#efdc92",
      ok: "#17622b", "ok-soft": "#d9eacb", bad: "#a1231a", "bad-soft": "#f3d6c8", warn: "#6e4300", "warn-soft": "#f0dfa5", shadow: SHADOW_LIGHT } },
    { id: "garden", name: "Garden", tone: "light", vars: {
      bg: "#d4e5d1", "bg-alt": "#c6dcc2", surface: "#e8f2e5", text: "#1a2e1f", muted: "#41584a", border: "#aecdae", axis: "#97b699",
      accent: "#2a7048", "accent-strong": "#1d5b38", "accent-ink": "#ffffff", "accent-soft": "#bfdfc7",
      ok: "#16623a", "ok-soft": "#c8e5d1", bad: "#a1231a", "bad-soft": "#f0d4cf", warn: "#6e4600", "warn-soft": "#ece0b8", shadow: SHADOW_LIGHT } },
    { id: "coffee", name: "Coffee", tone: "light", vars: {
      bg: "#dccab4", "bg-alt": "#cfba9f", surface: "#ede1d1", text: "#33241a", muted: "#5a4333", border: "#bda587", axis: "#a78d6f",
      accent: "#85471f", "accent-strong": "#683716", "accent-ink": "#ffffff", "accent-soft": "#e0c4a4",
      ok: "#285f31", "ok-soft": "#d4e3cf", bad: "#a1241a", "bad-soft": "#f0d3c7", warn: "#6e4300", "warn-soft": "#ecdcb4", shadow: SHADOW_LIGHT } },
    { id: "chocolate", name: "Chocolate", tone: "dark", vars: {
      bg: "#2e201a", "bg-alt": "#382822", surface: "#43322b", text: "#f1e4d6", muted: "#cbb19c", border: "#5b463b", axis: "#705649",
      accent: "#eaa76c", "accent-strong": "#f4bf8c", "accent-ink": "#2a1a12", "accent-soft": "#5f4131",
      ok: "#7ed39a", "ok-soft": "#263a2c", bad: "#ff9c8e", "bad-soft": "#4e2b27", warn: "#f2c55e", "warn-soft": "#4a3b1d", shadow: SHADOW_DARK } },
    { id: "honey", name: "Honey", tone: "light", vars: {
      bg: "#f0d78a", "bg-alt": "#e7cb70", surface: "#f8e8b5", text: "#38280a", muted: "#654f1e", border: "#d1b45d", axis: "#bd9f48",
      accent: "#9c5200", "accent-strong": "#7d4100", "accent-ink": "#ffffff", "accent-soft": "#eecf7a",
      ok: "#1a6229", "ok-soft": "#d6e6c0", bad: "#9f2419", "bad-soft": "#f2d3bf", warn: "#6c4000", "warn-soft": "#eedb9b", shadow: SHADOW_LIGHT } },
  ];
  const CUSTOM = { id: "custom", name: "Custom", tone: null };
  const DEFAULT_CUSTOM = { bg: "#e7e0f2", text: "#251d36", accent: "#7a3fd1" };

  // ---- colour maths -----------------------------------------------------------------------------------------------

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function parse(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (rgb) => "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = parse(a); const y = parse(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

  // WCAG relative luminance and contrast ratio (1 to 21).
  function luminance(hex) {
    const [r, g, b] = parse(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Moves `color` towards white or black (whichever helps) until it reads on `bg` with at least `ratio`.
  function readable(color, bg, ratio = 4.5) {
    if (contrast(color, bg) >= ratio) return color;
    const target = contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000000" : "#ffffff";   // whichever reads better on this background
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const c = mix(color, target, t);
      if (contrast(c, bg) >= ratio) return c;
    }
    return target;
  }

  const isColor = (v) => !!parse(v);

  // The three colours a player picks (page, text, accent) become a whole palette. Text is pushed towards black or
  // white if it would be hard to read, so a custom theme can never be made unreadable.
  function deriveCustom(pick) {
    const bg = isColor(pick && pick.bg) ? pick.bg.toLowerCase() : DEFAULT_CUSTOM.bg;
    // Light text on a dark page, dark text on a light one: whichever of black and white reads better on the page colour.
    const dark = luminance(bg) < 0.179;
    // Cards stand out a little from the page. On a mid-dark page the card is darkened (white text then has more to work with).
    const surface = dark ? (luminance(bg) > 0.06 ? mix(bg, "#000000", 0.14) : mix(bg, "#ffffff", 0.07)) : mix(bg, "#ffffff", 0.5);
    const wanted = isColor(pick && pick.text) ? pick.text.toLowerCase() : DEFAULT_CUSTOM.text;
    const text = readable(readable(wanted, surface, 7), bg, 7);
    const accentRaw = isColor(pick && pick.accent) ? pick.accent.toLowerCase() : DEFAULT_CUSTOM.accent;
    const accent = readable(accentRaw, surface, 3.2);
    const accentInk = contrast("#ffffff", accent) >= contrast("#101010", accent) ? "#ffffff" : "#101010";
    const tone = dark ? "dark" : "light";
    const base = THEMES.find((t) => t.id === tone).vars;
    return {
      tone,
      vars: {
        bg, "bg-alt": mix(bg, text, 0.07), surface, text,
        muted: readable(mix(text, surface, 0.3), surface, 4.6), border: mix(bg, text, 0.2), axis: mix(bg, text, 0.32),
        accent, "accent-strong": readable(mix(accent, text, 0.22), surface, 3.2), "accent-ink": accentInk, "accent-soft": mix(bg, accent, 0.22),
        ok: base.ok, "ok-soft": base["ok-soft"], bad: base.bad, "bad-soft": base["bad-soft"], warn: base.warn, "warn-soft": base["warn-soft"], shadow: base.shadow,
      },
    };
  }

  const byId = (id) => THEMES.find((t) => t.id === id) || null;
  const isThemeId = (id) => id === "custom" || !!byId(id);

  // The colours for a theme id (and, for "custom", the player's three picks). Falls back to Light for anything unknown.
  function resolve(id, custom) {
    if (id === "custom") { const c = deriveCustom(custom); return { id, tone: c.tone, vars: { ...c.vars, ...TONE[c.tone] } }; }
    const t = byId(id) || byId("light");
    return { id: t.id, tone: t.tone, vars: { ...t.vars, ...TONE[t.tone] } };
  }

  // Puts a theme on the page: the palette as CSS variables on <html> (through the style object, which the page's content
  // security policy allows), plus data-theme and data-tone for the style sheets.
  function apply(html, id, custom) {
    const r = resolve(id, custom);
    for (const [k, v] of Object.entries(r.vars)) html.style.setProperty(k === "color-scheme" ? k : "--" + k, v);
    html.setAttribute("data-theme", r.id);
    html.setAttribute("data-tone", r.tone);
    return r;
  }

  const api = { KEYS, TONE, THEMES, CUSTOM, DEFAULT_CUSTOM, parse, mix, luminance, contrast, readable, isColor, deriveCustom, byId, isThemeId, resolve, apply };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).themeData = api;
})(typeof window !== "undefined" ? window : globalThis);
