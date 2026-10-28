/* Runs in <head> so the saved theme and scene are applied before the first paint (no flash).
   Without a saved choice it follows the device and keeps following it.
   The keys and rules match js/ui/themes.js, which takes over once the app has loaded. */
(function () {
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  var query = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function apply() {
    var saved = get("typeLab.theme");
    var mode = saved === "light" || saved === "dark" ? saved : query && query.matches ? "dark" : "light";
    var html = document.documentElement;
    html.setAttribute("data-theme", mode);
    var scene = get("typeLab.scene." + mode);
    if (scene && /^[a-z-]+$/.test(scene)) html.setAttribute("data-scene", scene);
    else html.removeAttribute("data-scene");
  }

  apply();
  if (query && query.addEventListener) query.addEventListener("change", apply);
})();
