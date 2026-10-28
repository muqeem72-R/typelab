/* TypeLab themes: a colour mode (auto, light or dark) plus a background scene for each mode.
   Dark scenes belong to the dark mode and light scenes to the light mode, and the choice for
   each mode is remembered separately, so switching mode brings back that mode's own scene.

   Saved in localStorage as typeLab.theme (light | dark, absent = follow the device),
   typeLab.scene.light and typeLab.scene.dark (a scene id, absent = plain).
   js/theme.js applies the same keys before the first paint. */
(function (root) {
  "use strict";

  const { h } = root.TL.ui;

  const MODE_KEY = "typeLab.theme";
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

  const mode = () => { const m = read(MODE_KEY); return m === "light" || m === "dark" ? m : "system"; };
  const prefersDark = () => !!(root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolved = () => (mode() === "system" ? (prefersDark() ? "dark" : "light") : mode());

  // The saved scene for a mode, or "plain" when none is saved or the id is not one of that mode's scenes.
  function scene(m = resolved()) {
    const id = read(SCENE_KEY[m]);
    return SCENES[m].some(([sid]) => sid === id) ? id : "plain";
  }

  function apply() {
    const html = document.documentElement;
    const m = resolved();
    html.setAttribute("data-theme", m);
    const id = scene(m);
    if (id === "plain") html.removeAttribute("data-scene");
    else html.setAttribute("data-scene", id);
    notify();
  }

  // Iterates over a copy, because a picker removes itself from the list when it is no longer on the page.
  const notify = () => { for (const fn of [...listeners]) fn(); };

  function setMode(m) {
    write(MODE_KEY, m === "system" ? null : m);
    apply();
  }

  function setScene(m, id) {
    write(SCENE_KEY[m], id === "plain" ? null : id);
    if (m === resolved()) apply();
    else notify();
  }

  const onChange = (fn) => { listeners.push(fn); };

  // The picker: a mode switch and the scenes of the mode that is showing right now.
  function picker() {
    const el = h("div", { class: "themer" });

    function draw() {
      const m = resolved();
      const current = scene(m);
      const modeBtn = (value, label) => h("button", {
        class: "seg" + (mode() === value ? " on" : ""), type: "button", role: "radio", "data-key": "mode:" + value,
        "aria-checked": String(mode() === value), onclick: () => setMode(value),
      }, label);
      const option = (id, name) => h("button", {
        class: "scene-opt", type: "button", role: "radio", "aria-checked": String(current === id), "data-key": "scene:" + id,
        "data-scene": id === "plain" ? null : id, "data-plain": id === "plain" ? "" : null,
        onclick: () => setScene(m, id),
      }, h("span", { class: "scene-img", "aria-hidden": "true" }), h("span", { class: "scene-name" }, name));

      // Redrawing replaces the buttons, so remember which one had the keyboard focus.
      const focused = el.contains(document.activeElement) ? document.activeElement.getAttribute("data-key") : null;
      el.textContent = "";
      el.append(
        h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Colour mode" },
          modeBtn("system", "Auto"), modeBtn("light", "Light"), modeBtn("dark", "Dark")),
        h("p", { class: "themer-h" }, m === "dark" ? "Dark scenes" : "Light scenes",
          h("span", { class: "hint" }, "Each mode remembers its own scene. Switch the mode above to choose for the other one.")),
        h("div", { class: "scenes", role: "radiogroup", "aria-label": m === "dark" ? "Dark scene" : "Light scene" },
          option("plain", "Plain"), ...SCENES[m].map(([id, name]) => option(id, name))));
      const back = focused && el.querySelector(`[data-key="${focused}"]`);
      if (back) back.focus();
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

  root.TL.themes = { SCENES, mode, resolved, scene, setMode, setScene, apply, onChange, picker };
})(window);
