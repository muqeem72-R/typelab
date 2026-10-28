const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../js/core/themedata.js");

const NAMES = ["Light", "Dark", "Gray", "Yellow", "Garden", "Coffee", "Chocolate", "Honey"];

test("the themes are the ones asked for, plus Custom", () => {
  assert.deepEqual(T.THEMES.map((t) => t.name), NAMES);
  assert.equal(T.CUSTOM.name, "Custom");
  assert.equal(new Set(T.THEMES.map((t) => t.id)).size, T.THEMES.length);
  for (const t of T.THEMES) assert.ok(["light", "dark"].includes(t.tone), t.id);
});

test("every theme sets every colour, and they are all real six-digit colours", () => {
  for (const t of T.THEMES) {
    assert.deepEqual(Object.keys(t.vars).sort(), [...T.KEYS].sort(), `${t.id}: the list of colours differs`);
    for (const k of T.KEYS) if (k !== "shadow") assert.ok(T.isColor(t.vars[k]), `${t.id} ${k} = ${t.vars[k]}`);
  }
});

test("no theme is pure white or pure black, and the dark themes are dark but not black", () => {
  for (const t of T.THEMES) {
    for (const k of ["bg", "bg-alt", "surface"]) {
      assert.notEqual(t.vars[k], "#ffffff", `${t.id} ${k} is pure white`);
      assert.notEqual(t.vars[k], "#000000", `${t.id} ${k} is pure black`);
    }
    const l = T.luminance(t.vars.bg);
    if (t.tone === "dark") assert.ok(l > 0.008 && l < 0.12, `${t.id}: the page colour is too black or too bright (${l.toFixed(3)})`);
    else assert.ok(l > 0.2 && l < 0.88, `${t.id}: the page colour is too dark or too white (${l.toFixed(3)})`);
  }
});

test("text can be read in every theme: text, quiet text, buttons, and the green, red and amber notes", () => {
  for (const t of T.THEMES) {
    const v = t.vars;
    const c = (a, b) => T.contrast(a, b);
    for (const bg of [v.bg, v["bg-alt"], v.surface]) assert.ok(c(v.text, bg) >= 7, `${t.id}: text on ${bg} is ${c(v.text, bg).toFixed(1)}`);
    assert.ok(c(v.muted, v.surface) >= 4.5, `${t.id}: quiet text on cards is ${c(v.muted, v.surface).toFixed(1)}`);
    assert.ok(c(v.muted, v.bg) >= 4.5, `${t.id}: quiet text on the page is ${c(v.muted, v.bg).toFixed(1)}`);
    assert.ok(c(v["accent-ink"], v.accent) >= 4.5, `${t.id}: button text is ${c(v["accent-ink"], v.accent).toFixed(1)}`);
    assert.ok(c(v.accent, v.surface) >= 3.2, `${t.id}: the accent on cards is ${c(v.accent, v.surface).toFixed(1)}`);
    assert.ok(c(v.text, v["accent-soft"]) >= 4.5, `${t.id}: text on the soft accent is ${c(v.text, v["accent-soft"]).toFixed(1)}`);
    for (const k of ["ok", "bad", "warn"]) {
      assert.ok(c(v[k], v[k + "-soft"]) >= 4.5, `${t.id}: ${k} on its soft colour is ${c(v[k], v[k + "-soft"]).toFixed(1)}`);
      assert.ok(c(v[k], v.surface) >= 4.5, `${t.id}: ${k} on cards is ${c(v[k], v.surface).toFixed(1)}`);
    }
  }
});

test("the themes look different from one another", () => {
  const seen = new Set();
  for (const t of T.THEMES) { seen.add(t.vars.bg); }
  assert.equal(seen.size, T.THEMES.length, "two themes share a page colour");
  for (let i = 0; i < T.THEMES.length; i++) for (let j = i + 1; j < T.THEMES.length; j++) {
    const d = T.contrast(T.THEMES[i].vars.bg, T.THEMES[j].vars.bg);
    assert.ok(d > 1.01 || T.THEMES[i].vars.accent !== T.THEMES[j].vars.accent, `${T.THEMES[i].id} and ${T.THEMES[j].id} look the same`);
  }
});

test("resolving a theme gives its colours and its tone's extras, and unknown names fall back to Light", () => {
  const dark = T.resolve("dark");
  assert.equal(dark.tone, "dark");
  assert.equal(dark.vars["color-scheme"], "dark");
  assert.equal(dark.vars.sp1, T.TONE.dark.sp1);
  assert.equal(T.resolve("coffee").vars["color-scheme"], "light");
  assert.equal(T.resolve("nonsense").id, "light");
  assert.equal(T.resolve(undefined).id, "light");
  assert.ok(T.isThemeId("custom") && T.isThemeId("honey") && !T.isThemeId("auto"));
});

test("a custom theme is built from three colours and can never be unreadable", () => {
  const picks = [
    { bg: "#e7e0f2", text: "#251d36", accent: "#7a3fd1" },     // the default
    { bg: "#101820", text: "#c8e6ff", accent: "#28a0ff" },     // a dark one
    { bg: "#ffffff", text: "#ffffff", accent: "#ffffff" },     // everything white
    { bg: "#000000", text: "#000000", accent: "#000000" },     // everything black
    { bg: "#808080", text: "#8a8a8a", accent: "#7f7f7f" },     // grey on grey
    { bg: "#ffe600", text: "#fff176", accent: "#ffee58" },     // yellow on yellow
    { bg: "banana", text: null, accent: undefined },            // not colours at all
    null, undefined,
  ];
  for (const pick of picks) {
    const r = T.resolve("custom", pick);
    const v = r.vars;
    assert.deepEqual(Object.keys(v).filter((k) => T.KEYS.includes(k)).sort(), [...T.KEYS].sort(), JSON.stringify(pick));
    assert.ok(["light", "dark"].includes(r.tone));
    assert.ok(T.contrast(v.text, v.surface) >= 7, `${JSON.stringify(pick)}: text ${T.contrast(v.text, v.surface).toFixed(1)}`);
    assert.ok(T.contrast(v.text, v.bg) >= 4.5, `${JSON.stringify(pick)}: text on the page ${T.contrast(v.text, v.bg).toFixed(1)}`);
    assert.ok(T.contrast(v.muted, v.surface) >= 4.5, `${JSON.stringify(pick)}: quiet text`);
    assert.ok(T.contrast(v["accent-ink"], v.accent) >= 4.5, `${JSON.stringify(pick)}: button text`);
    assert.ok(T.contrast(v.accent, v.surface) >= 3, `${JSON.stringify(pick)}: accent`);
  }
  assert.equal(T.resolve("custom", { bg: "#101820", text: "#c8e6ff", accent: "#28a0ff" }).tone, "dark");
  assert.equal(T.resolve("custom", { bg: "#e7e0f2", text: "#251d36", accent: "#7a3fd1" }).tone, "light");
  assert.equal(T.resolve("custom", { bg: "#e7e0f2", text: "#251d36", accent: "#7a3fd1" }).vars.bg, "#e7e0f2", "the page colour is the one picked");
});

test("applying a theme sets the variables, the name and the tone on the page", () => {
  const set = {};
  const attrs = {};
  const html = { style: { setProperty: (k, v) => { set[k] = v; } }, setAttribute: (k, v) => { attrs[k] = v; } };
  const r = T.apply(html, "chocolate");
  assert.equal(r.tone, "dark");
  assert.equal(attrs["data-theme"], "chocolate");
  assert.equal(attrs["data-tone"], "dark");
  assert.equal(set["--bg"], T.byId("chocolate").vars.bg);
  assert.equal(set["color-scheme"], "dark");
  assert.ok(set["--sp3"] && set["--er3"], "the heat-map colours come with it");
});

test("hex colours are mixed and measured correctly", () => {
  assert.equal(T.mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(T.mix("#102030", "#102030", 0.7), "#102030");
  assert.ok(Math.abs(T.contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(T.contrast("#777777", "#777777") - 1) < 0.001);
  assert.equal(T.parse("nope"), null);
  assert.deepEqual(T.parse("#ff8000"), [255, 128, 0]);
  assert.equal(T.readable("#777777", "#808080"), T.readable("#777777", "#808080"));
  assert.ok(T.contrast(T.readable("#777777", "#808080", 4.5), "#808080") >= 4.5);
});
