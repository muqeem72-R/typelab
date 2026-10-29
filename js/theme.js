/* Runs in <head> so the saved theme and background picture are on the page before the first paint (no flash).
   Without a saved choice it follows the device (Light or Dark) and keeps following it.
   The colours come from js/core/themedata.js. The keys and rules match js/ui/themes.js, which takes over once the app has loaded.

   Saved in localStorage:  typeLab.theme         a theme id: light, dark, gray, yellow, garden, coffee, chocolate, honey or custom
                           typeLab.theme.custom  { bg, text, accent } for the Custom theme
                           typeLab.scene         the background picture, the same for every theme (absent = plain)
                           typeLab.scene.light / .dark   the older per-tone choice, read only when typeLab.scene was never set */
(function () {
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  var query = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var data = window.TL && window.TL.themeData;

  function apply() {
    var html = document.documentElement;
    var saved = get("typeLab.theme");
    var id = data && data.isThemeId(saved) ? saved : query && query.matches ? "dark" : "light";
    var pick = null;
    try { pick = JSON.parse(get("typeLab.theme.custom")); } catch (e) { pick = null; }
    var tone = data ? data.apply(html, id, pick).tone : id === "dark" ? "dark" : "light";
    if (!data) { html.setAttribute("data-theme", id); html.setAttribute("data-tone", tone); }
    var scene = get("typeLab.scene");
    if (scene === null) scene = get("typeLab.scene." + tone);
    if (scene && scene !== "plain" && /^[a-z-]+$/.test(scene)) html.setAttribute("data-scene", scene);
    else html.removeAttribute("data-scene");
  }

  apply();
  if (query && query.addEventListener) query.addEventListener("change", apply);
})();
