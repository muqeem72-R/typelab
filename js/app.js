/* TypeLab app shell: hash router, login gate, header pop-ups (themes and account), guided tours
   and page titles. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  TL.account.init();   // points the store at this player's data before anything reads it

  const main = document.getElementById("app");
  const themeBtn = document.getElementById("theme-btn");
  const themesBtn = document.getElementById("themes-btn");
  const themesPop = document.getElementById("themes-pop");
  const userEl = document.getElementById("user");
  const navLinks = [...document.querySelectorAll("#nav a")];
  document.getElementById("back-link").href = TL.config.portfolioUrl;

  const ROUTES = {
    "": "home", practice: "practice", course: "course", stats: "stats", settings: "settings", learn: "learn",
    login: "login", certificate: "certificate",
  };
  const OPEN_ROUTES = ["login", "certificate"];   // reachable without being logged in
  let cleanup = null;

  // ---- header pop-ups ------------------------------------------------------------------------

  const popups = [];   // { button, panel, build }

  function closeAll(except, refocus) {
    for (const p of popups) {
      if (p === except || p.panel.hidden) continue;
      p.panel.hidden = true;
      p.button.setAttribute("aria-expanded", "false");
      if (refocus) p.button.focus();
    }
  }

  function popup(button, panel, build) {
    const p = { button, panel, build };
    popups.push(p);
    button.addEventListener("click", () => {
      if (!panel.hidden) { closeAll(null, false); return; }
      closeAll(p, false);
      if (build) build();
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      const first = panel.querySelector('.scene-opt[aria-checked="true"], a, button');
      if (first) first.focus();
    });
    return p;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popups.some((p) => !p.panel.hidden)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeAll(null, true);
    }
  }, true);
  document.addEventListener("pointerdown", (e) => {
    for (const p of popups) if (!p.panel.hidden && !p.panel.contains(e.target) && !p.button.contains(e.target)) closeAll(null, false);
  });

  popup(themesBtn, themesPop, () => { if (!themesPop.firstChild) themesPop.append(TL.themes.picker()); });

  // ---- theme ---------------------------------------------------------------------------------

  function updateThemeButton() {
    const dark = TL.themes.resolved() === "dark";
    themeBtn.textContent = dark ? "☀" : "☾";
    themeBtn.setAttribute("aria-label", dark ? "Switch to the light theme" : "Switch to the dark theme");
  }
  themeBtn.addEventListener("click", () => TL.themes.setMode(TL.themes.resolved() === "dark" ? "light" : "dark"));
  TL.themes.onChange(updateThemeButton);

  // The skin tone of the hands guide: data-skin on <html> switches the colour variables.
  function applySkin() {
    document.documentElement.setAttribute("data-skin", TL.store.load().settings.handTone);
  }

  // ---- account button ------------------------------------------------------------------------

  function renderUser() {
    userEl.textContent = "";
    if (!TL.account.loggedIn()) {
      userEl.append(h("a", { class: "btn primary small", href: "#/login" }, "Log in"));
      return;
    }
    const p = TL.account.current();
    const score = TL.rank.score(TL.store.load().sessions);
    const tier = TL.rank.tierFor(score);
    const button = h("button", { class: "user-btn", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "user-pop" },
      h("span", { class: "avatar", "aria-hidden": "true" }, TL.account.initials()),
      h("span", { class: "user-name" }, TL.account.firstName()));
    const panel = h("div", { class: "theme-pop user-pop", id: "user-pop", role: "dialog", "aria-label": "Your account", hidden: "" });
    userEl.append(button, panel);
    popup(button, panel, () => {
      panel.textContent = "";
      const rank = p.rank && p.rank.rank ? `Rank #${p.rank.rank} of ${p.rank.total}` : "Not ranked yet";
      panel.append(
        h("div", { class: "user-card" },
          h("span", { class: "avatar big", "aria-hidden": "true" }, TL.account.initials()),
          h("div", null, h("strong", null, p.name), h("div", { class: "muted" }, `${tier.name}, ${rank}`))),
        h("div", { class: "user-links" },
          h("a", { href: "#/stats", onclick: () => closeAll(null, false) }, "Progress, rank and certificates"),
          h("a", { href: "#/settings", onclick: () => closeAll(null, false) }, "Settings"),
          h("button", { class: "link-btn", type: "button", onclick: () => { TL.account.logout(); location.hash = "#/login"; location.reload(); } }, "Log out")));
    });
  }

  // The login ran out (the token expired). Tell the player without interrupting what they are typing.
  TL.account.onLost(() => {
    if (document.querySelector(".auth-banner")) return;
    document.body.prepend(h("div", { class: "auth-banner", role: "alert" }, "Your login has run out. ", h("a", { href: "#/login" }, "Log in again"), " to keep your rank."));
  });

  // ---- routing -------------------------------------------------------------------------------

  // Which tours belong to the page that was just opened. The menu tour comes first.
  function toursFor(name, parts) {
    if (OPEN_ROUTES.includes(name)) return [];
    const page = { "": "home", practice: "practice", course: parts[0] ? "lesson" : "course", stats: "progress", settings: "settings" }[name];
    return page ? ["nav", page] : ["nav"];
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const name = parts[0] || "";

    if (name === "test") { location.replace("#/practice"); return; }   // the speed tests now live inside Practice
    const key = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null;
    if (key && !OPEN_ROUTES.includes(name) && TL.account.needsLogin()) { location.replace("#/login"); return; }

    if (cleanup) { cleanup(); cleanup = null; }
    TL.tour.stop();
    TL.ui.tip.hide();
    closeAll(null, false);
    main.textContent = "";
    document.body.classList.toggle("on-login", name === "login");
    if (name === "login") document.querySelectorAll(".auth-banner").forEach((b) => b.remove());

    if (!key) {
      main.append(h("div", { class: "page-head" },
        h("h1", null, "Page not found"),
        h("p", { class: "lead" }, "That page does not exist."),
        h("p", null, h("a", { class: "btn primary", href: "#/" }, "Go to the start page"))));
      document.title = "Not found | TypeLab";
    } else {
      const page = TL.pages[key];
      try {
        cleanup = page.mount(main, parts.slice(1)) || null;
      } catch (err) {
        console.error(err);
        main.textContent = "";
        main.append(h("p", { class: "notice" }, "Something went wrong while loading this page. Please reload it. Your saved progress is not affected."));
      }
      document.title = key === "home" ? "TypeLab | Learn to touch type" : page.title + " | TypeLab";
    }

    for (const a of navLinks) {
      if (a.getAttribute("href") === "#/" + name && name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    root.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    TL.tour.maybeStart(toursFor(name, parts.slice(1)));
  }

  root.addEventListener("hashchange", route);
  TL.themes.apply();
  applySkin();
  renderUser();
  route();

  TL.app = { applySkin, renderUser };
})(window);
