/* TypeLab themes: eight ready-made colour themes (Light, Dark, Gray, Yellow, Garden, Coffee, Chocolate, Honey) and a Custom one
   built from three colours the player picks, plus an optional background picture that fits the theme's tone (dark pictures for
   dark themes, day pictures for light ones). The colours are in js/core/themedata.js.

   Saved in localStorage as typeLab.theme (a theme id; absent = follow the device), typeLab.theme.custom ({ bg, text, accent }),
   typeLab.scene.light and typeLab.scene.dark (a picture id, absent = plain). js/theme.js applies the same keys before the first paint. */
(function (root) {
  "use strict";

  const { h } = root.TL.ui;
  const D = root.TL.themeData;

  const MODE_KEY = "typeLab.theme";
  const CUSTOM_KEY = "typeLab.theme.custom";
  const SCENE_KEY = { light: "typeLab.scene.light", dark: "typeLab.scene.dark" };

  const SCENES = {
    dark: [
      ["night-sky", "Night sky"], ["moon", "Moonlight"], ["city-night", "City at night"],
      ["sea-night", "Sea at night"], ["aurora", "Northern lights"], ["desert-night", "Desert fort"],
    ],
    light: [
      ["sunrise", "Sunrise"], ["sunset", "Sunset"], ["park", "Park"],
      ["beach", "Beach"], ["mountains", "Mountains"], ["cloud-sea", "Above the clouds"],
    ],
  };

  const read = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const write = (key, value) => {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* storage blocked: lasts for this visit */ }
  };

  const listeners = [];

  const prefersDark = () => !!(root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);

  // The saved theme id, or Light/Dark following the device when none is saved.
  function current() {
    const saved = read(MODE_KEY);
    if (D.isThemeId(saved)) return saved;
    return prefersDark() ? "dark" : "light";
  }
  const chosen = () => D.isThemeId(read(MODE_KEY));   // false while it is simply following the device

  function custom() {
    try {
      const c = JSON.parse(read(CUSTOM_KEY));
      if (c && D.isColor(c.bg) && D.isColor(c.text) && D.isColor(c.accent)) return { bg: c.bg, text: c.text, accent: c.accent };
    } catch (e) { /* no custom colours saved */ }
    return { ...D.DEFAULT_CUSTOM };
  }

  const tone = () => D.resolve(current(), custom()).tone;

  // The saved picture for a tone, or "plain" when none is saved or the id is not one of that tone's pictures.
  function scene(t = tone()) {
    const id = read(SCENE_KEY[t]);
    return SCENES[t].some(([sid]) => sid === id) ? id : "plain";
  }

  // `quiet` puts the colours on the page without telling the pickers, so a colour control that is being dragged is not rebuilt under the finger.
  function apply(quiet) {
    const html = document.documentElement;
    const r = D.apply(html, current(), custom());
    const id = scene(r.tone);
    if (id === "plain") html.removeAttribute("data-scene");
    else html.setAttribute("data-scene", id);
    if (quiet !== true) notify();
  }

  // Iterates over a copy, because a picker removes itself from the list when it is no longer on the page.
  const notify = () => { for (const fn of [...listeners]) fn(); };

  function setTheme(id) {
    if (D.isThemeId(id)) write(MODE_KEY, id);
    else write(MODE_KEY, null);
    apply();
  }

  function setCustom(pick, quiet) {
    write(CUSTOM_KEY, JSON.stringify({ bg: pick.bg, text: pick.text, accent: pick.accent }));
    write(MODE_KEY, "custom");
    apply(quiet);
  }

  function setScene(t, id) {
    write(SCENE_KEY[t], id === "plain" ? null : id);
    if (t === tone()) apply();
    else notify();
  }

  const onChange = (fn) => { listeners.push(fn); };

  // The picker: the themes as small previews, the three colours when Custom is chosen, and the pictures that suit the tone.
  function picker() {
    const el = h("div", { class: "themer" });
    let draft = custom();   // the colours being picked, kept while the player drags a colour control

    function paint(sw, vars) {
      sw.children[0].style.background = vars.bg;
      sw.children[1].style.background = vars.surface;
      sw.children[2].style.background = vars.accent;
      sw.style.borderColor = vars.border;
    }
    function swatch(vars) {
      const sw = h("span", { class: "theme-sw", "aria-hidden": "true" }, h("span", { class: "sw-page" }), h("span", { class: "sw-card" }), h("span", { class: "sw-accent" }));
      paint(sw, vars);
      return sw;
    }

    function draw() {
      const id = current();
      const t = tone();
      const picture = scene(t);
      const opt = (key, name, vars, checked, onclick) => h("button", {
        class: "theme-opt", type: "button", role: "radio", "aria-checked": String(checked), "data-key": "theme:" + key, onclick,
      }, swatch(vars), h("span", { class: "theme-name" }, name));
      const option = (sid, name) => h("button", {
        class: "scene-opt", type: "button", role: "radio", "aria-checked": String(picture === sid), "data-key": "scene:" + sid,
        "data-scene": sid === "plain" ? null : sid, "data-plain": sid === "plain" ? "" : null,
        onclick: () => setScene(t, sid),
      }, h("span", { class: "scene-img", "aria-hidden": "true" }), h("span", { class: "scene-name" }, name));
      const colourInput = (key, label) => {
        const input = h("input", { type: "color", id: "theme-c-" + key, value: draft[key] });
        input.addEventListener("input", () => {
          draft = { ...draft, [key]: input.value };
          setCustom(draft, true);   // the page follows the colour as it is dragged
          const sw = el.querySelector('[data-key="theme:custom"] .theme-sw');
          if (sw) paint(sw, D.resolve("custom", draft).vars);
        });
        input.addEventListener("change", () => notify());   // the colour is chosen: let everything that shows the tone catch up
        return h("label", { class: "custom-pick", for: "theme-c-" + key }, input, h("span", null, label));
      };

      // Redrawing replaces the buttons, so remember which one had the keyboard focus.
      const active = el.contains(document.activeElement) ? document.activeElement : null;
      const focused = active ? active.getAttribute("data-key") || active.id : null;
      el.textContent = "";
      el.append(
        h("div", { class: "theme-grid", role: "radiogroup", "aria-label": "Theme" },
          ...D.THEMES.map((th) => opt(th.id, th.name, th.vars, chosen() && id === th.id, () => setTheme(th.id))),
          opt("custom", "Custom", D.resolve("custom", draft).vars, id === "custom", () => { draft = custom(); setCustom(draft); })),
        ...(id === "custom" ? [h("div", { class: "custom-panel" },
          h("p", { class: "themer-h" }, "Your colours", h("span", { class: "hint" }, "Pick three colours. TypeLab works out the rest and keeps the text easy to read, whatever you pick.")),
          h("div", { class: "custom-row" }, colourInput("bg", "Page"), colourInput("text", "Text"), colourInput("accent", "Buttons and highlights"),
            h("button", { class: "btn small", type: "button", onclick: () => { draft = { ...D.DEFAULT_CUSTOM }; setCustom(draft); } }, "Reset colours")))] : []),
        h("p", { class: "themer-h" }, "Background picture",
          h("span", { class: "hint" }, t === "dark" ? "Night pictures, for dark themes." : "Day pictures, for light themes. Each tone remembers its own.")),
        h("div", { class: "scenes", role: "radiogroup", "aria-label": "Background picture" },
          option("plain", "Plain"), ...SCENES[t].map(([sid, name]) => option(sid, name))));
      const back = focused && (el.querySelector(`[data-key="${focused}"]`) || el.querySelector(`#${CSS.escape(focused)}`));
      if (back && !(active && active.type === "color")) back.focus();
    }

    // A picker that has left the page stops listening, so opening Settings again and again leaks nothing.
    const redraw = () => {
      if (el.isConnected) draw();
      else listeners.splice(listeners.indexOf(redraw), 1);
    };
    onChange(redraw);
    draw();
    return el;
  }

  // `resolved` is kept for the header button: "dark" or "light", the tone of the theme in use.
  root.TL.themes = { SCENES, current, tone, resolved: tone, scene, custom, setTheme, setCustom, setScene, apply, onChange, picker };
})(window);
