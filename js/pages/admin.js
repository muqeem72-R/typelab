/* TypeLab owner view (#/admin): how people use the site. It shows every player's time on the site, real typing time,
   streak, speed and progress, as the server has them. Only the owner can open it: the page asks for the owner's key
   (the TYPELAB_ADMIN_KEY secret). The key is kept in this tab only (sessionStorage), never in the saved data. There is
   no link to this page anywhere on the site. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt, tile } = TL.ui;
  const KEY_STORE = "typeLab.admin";
  const DAY_MS = 86400000;

  const readKey = () => { try { return sessionStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } };
  const writeKey = (v) => { try { if (v) sessionStorage.setItem(KEY_STORE, v); else sessionStorage.removeItem(KEY_STORE); } catch (e) { /* the key then lasts for this page only */ } };

  const ago = (now, ts) => {
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  };
  const dayDate = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
  const mins = (ms) => (ms == null ? "-" : fmt.duration(ms));

  // Minutes typed and minutes on the site over the last 7 days, from the 14-day list a player reports.
  function lastWeek(p, now) {
    const today = Math.floor(now / DAY_MS);
    let typed = 0;
    let site = 0;
    for (const [d, t, s] of p.days || []) if (d >= today - 6) { typed += t; site += s; }
    return { typed: typed * 60000, site: site * 60000 };
  }

  const COLUMNS = [
    { id: "name", label: "Player", text: true, get: (p) => p.name.toLowerCase(), cell: (p) => p.name + (p.hidden ? " (hidden)" : "") },
    { id: "last", label: "Last seen", get: (p) => p.lastSeen, cell: (p, d) => ago(d.now, p.lastSeen), title: (p, d) => new Date(p.lastSeen).toLocaleString() },
    { id: "joined", label: "Joined", get: (p) => p.joined || 0, cell: (p) => (p.joined ? fmt.date(p.joined) : "-") },
    { id: "site", label: "On the site", get: (p) => p.siteMs || 0, cell: (p) => mins(p.siteMs) },
    { id: "typed", label: "Real typing", get: (p) => p.typedMs || 0, cell: (p) => mins(p.typedMs) },
    { id: "week", label: "Typed, 7 days", get: (p, d) => lastWeek(p, d.now).typed, cell: (p, d) => mins(lastWeek(p, d.now).typed) },
    { id: "streak", label: "Streak", get: (p) => p.streak == null ? -1 : p.streak, cell: (p) => (p.streak == null ? "-" : p.streak + " d") },
    { id: "sdays", label: "5-min days", get: (p) => p.streakDays == null ? -1 : p.streakDays, cell: (p) => (p.streakDays == null ? "-" : String(p.streakDays)) },
    { id: "best", label: "Best WPM", get: (p) => p.best, cell: (p) => (p.best ? fmt.num(p.best, 0) : "-") },
    { id: "score", label: "Score", get: (p) => p.score, cell: (p) => (p.score ? fmt.num(p.score, 1) : "-") },
    { id: "acc", label: "Accuracy", get: (p) => p.acc, cell: (p) => (p.acc ? p.acc + "%" : "-") },
    { id: "sessions", label: "Sessions", get: (p) => p.sessions, cell: (p) => String(p.sessions) },
    { id: "lessons", label: "Lessons", get: (p) => p.lessons, cell: (p) => p.lessons + "/24" },
  ];

  function csv(data) {
    const safe = (v) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;   // a spreadsheet must never read a name as a formula
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = ["Player", "Hidden", "Last seen", "Joined", "Minutes on the site", "Minutes of real typing", "Minutes typed, last 7 days", "Streak days", "Days with 5 minutes", "Active days", "Best WPM", "Score", "Accuracy", "Sessions", "Lessons"];
    const rows = data.players.map((p) => [
      p.name, p.hidden ? "yes" : "no", new Date(p.lastSeen).toISOString(), p.joined ? new Date(p.joined).toISOString() : "",
      p.siteMs == null ? "" : Math.round(p.siteMs / 60000), p.typedMs == null ? "" : Math.round(p.typedMs / 60000), Math.round(lastWeek(p, data.now).typed / 60000),
      p.streak == null ? "" : p.streak, p.streakDays == null ? "" : p.streakDays, p.activeDays == null ? "" : p.activeDays, p.best, p.score, p.acc, p.sessions, p.lessons,
    ]);
    return [head, ...rows].map((r) => r.map(safe).join(",")).join("\n");
  }

  // A row of 14 small bars: minutes typed each day (and, behind it, minutes on the site).
  function history(p) {
    const days = p.days || [];
    if (!days.length) return h("p", { class: "muted" }, "No daily numbers yet: this player has not reported any since the owner view was added.");
    const max = Math.max(30, ...days.map((d) => d[2]), ...days.map((d) => d[1]));
    const bar = (cls, minutes) => {
      const el = h("span", { class: "adm-bar " + cls });
      el.style.height = Math.max(minutes ? 2 : 0, (minutes / max) * 100) + "%";   // set through the style object: the page's policy forbids a style attribute
      return el;
    };
    return h("div", { class: "adm-days", role: "img", "aria-label": "Minutes on the site and minutes typed on each of the last days" },
      ...days.map(([d, typed, site]) => h("div", { class: "adm-day", title: `${dayDate(d)}: ${typed} min typed, ${site} min on the site` },
        bar("site", site), bar("typed", typed), h("span", { class: "adm-lbl" }, dayDate(d).slice(5)))));
  }

  function mount(main) {
    document.title = "Owner view | TypeLab";
    const state = { data: null, sort: "last", dir: -1, filter: "", open: new Set(), timer: null };

    const keyInput = h("input", { id: "adm-key", type: "password", autocomplete: "off", spellcheck: "false", "aria-describedby": "adm-err" });
    const err = h("p", { class: "field-err", id: "adm-err", role: "alert" });
    const gate = h("form", { class: "card adm-gate", onsubmit: (e) => { e.preventDefault(); load(keyInput.value.trim()); } },
      h("h2", { class: "sub" }, "Owner key"),
      h("p", { class: "muted" }, "This page is for the owner of this site. Enter the value of the TYPELAB_ADMIN_KEY secret you set in Cloudflare. It is kept in this tab only."),
      h("label", { for: "adm-key" }, "Owner key"), keyInput, err,
      h("button", { class: "btn primary", type: "submit" }, "Show the players"));
    const view = h("div", { hidden: true });
    main.append(h("div", { class: "page-head" }, h("h1", null, "Owner view"),
      h("p", { class: "lead" }, "How people use TypeLab: time on the site, real typing time, streaks and progress, as each player's browser last reported them.")), gate, view);

    const api = TL.apiClient.create({ base: TL.config.api, fetchImpl: root.fetch ? root.fetch.bind(root) : null, enabled: root.location.protocol !== "file:" });

    const MESSAGES = {
      "bad-admin-key": "That is not the owner key.", "admin-not-configured": "The owner view is switched off: add the TYPELAB_ADMIN_KEY secret to the Worker, then deploy.",
      "too-many": "Too many wrong keys from this connection. Try again in an hour.", "not-configured": "The server is not set up yet (TYPELAB_SALT and TYPELAB_SIGN_KEY).",
    };

    async function load(key) {
      err.textContent = "";
      if (!key) { err.textContent = "Enter the owner key."; return; }
      const r = await api.adminPlayers(key);
      if (!r.ok) {
        if (r.status === 401) writeKey("");
        err.textContent = r.offline && !r.status ? "The server could not be reached. Open the live site, not a saved copy of the page." : MESSAGES[r.error] || "Could not load the players (" + (r.error || r.status) + ").";
        return;
      }
      writeKey(key);
      keyInput.value = "";
      state.data = r.data;
      gate.hidden = true;
      view.hidden = false;
      draw();
      clearInterval(state.timer);
      state.timer = setInterval(() => { const k = readKey(); if (k && !document.hidden) refresh(k); }, 60000);
    }

    async function refresh(key) {
      const r = await api.adminPlayers(key);
      if (r.ok) { state.data = r.data; draw(); }
    }

    function lock() {
      writeKey("");
      clearInterval(state.timer);
      state.data = null;
      view.hidden = true;
      gate.hidden = false;
      keyInput.focus();
    }

    function sorted() {
      const col = COLUMNS.find((c) => c.id === state.sort) || COLUMNS[1];
      const d = state.data;
      const q = state.filter.trim().toLowerCase();
      const list = d.players.filter((p) => !q || p.name.toLowerCase().includes(q));
      list.sort((a, b) => {
        const x = col.get(a, d);
        const y = col.get(b, d);
        return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
      });
      return list;
    }

    function draw() {
      const d = state.data;
      view.textContent = "";
      if (!d) return;
      const day = d.now - DAY_MS;
      const week = d.now - 7 * DAY_MS;
      const sum = (f) => d.players.reduce((a, p) => a + (f(p) || 0), 0);
      const withBest = d.players.filter((p) => p.best > 0);
      view.append(
        h("div", { class: "tiles" },
          tile("Players", String(d.total), "who have logged in and synced"),
          tile("Seen in 24 hours", String(d.players.filter((p) => p.lastSeen >= day).length)),
          tile("Seen in 7 days", String(d.players.filter((p) => p.lastSeen >= week).length)),
          tile("Real typing, total", fmt.duration(sum((p) => p.typedMs)), "all players together"),
          tile("Time on the site, total", fmt.duration(sum((p) => p.siteMs)), "all players together"),
          tile("Average best speed", withBest.length ? fmt.num(withBest.reduce((a, p) => a + p.best, 0) / withBest.length, 0) + " WPM" : "-")),
        h("div", { class: "adm-tools" },
          h("label", { class: "sr-only", for: "adm-filter" }, "Find a player"),
          h("input", { id: "adm-filter", type: "search", placeholder: "Find a player", value: state.filter, oninput: (e) => { state.filter = e.target.value; drawTable(); } }),
          h("button", { class: "btn", type: "button", onclick: () => refresh(readKey()) }, "Refresh"),
          h("button", { class: "btn", type: "button", onclick: () => download() }, "Download CSV"),
          h("button", { class: "btn", type: "button", onclick: lock }, "Lock")),
        h("p", { class: "muted" }, `Updated ${new Date(d.now).toLocaleTimeString()} (it refreshes by itself every minute). A player's numbers arrive when they log in, finish a session, or about every three minutes while they are here.`),
        h("div", { class: "table-wrap", id: "adm-table" }),
        h("p", { class: "muted" }, "Times are what each player's browser reports, so treat them as a good guide, not as proof. \"On the site\" counts while the tab is showing and the player is using it. \"Real typing\" counts only the seconds spent typing; breaks are left out. Click a player to see the last 14 days."));
      drawTable();
    }

    function drawTable() {
      const holder = document.getElementById("adm-table");
      if (!holder || !state.data) return;
      const d = state.data;
      const list = sorted();
      const head = h("tr", null, ...COLUMNS.map((c) => h("th", { scope: "col", "aria-sort": c.id === state.sort ? (state.dir > 0 ? "ascending" : "descending") : "none" },
        h("button", { class: "adm-sort", type: "button", onclick: () => { if (state.sort === c.id) state.dir = -state.dir; else { state.sort = c.id; state.dir = c.text ? 1 : -1; } drawTable(); } },
          c.label + (c.id === state.sort ? (state.dir > 0 ? " ▲" : " ▼") : "")))));
      const rows = [];
      for (const p of list) {
        const open = state.open.has(p.id);
        rows.push(h("tr", { class: "adm-row" + (open ? " open" : ""), tabindex: "0", "aria-expanded": String(open),
          onclick: () => { if (open) state.open.delete(p.id); else state.open.add(p.id); drawTable(); },
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open) state.open.delete(p.id); else state.open.add(p.id); drawTable(); } } },
          ...COLUMNS.map((c) => h("td", { title: c.title ? c.title(p, d) : null }, c.cell(p, d)))));
        if (open) rows.push(h("tr", { class: "adm-more" }, h("td", { colspan: String(COLUMNS.length) },
          h("div", { class: "adm-detail" }, h("p", { class: "muted" }, `${p.name}: ${p.activeDays == null ? "-" : p.activeDays} active days, first seen ${p.firstDay ? dayDate(p.firstDay) : "-"}. Tall bar: minutes on the site. Bright bar: minutes typed.`), history(p)))));
      }
      holder.textContent = "";
      holder.append(list.length ? h("table", { class: "adm-table" }, h("thead", null, head), h("tbody", null, ...rows)) : h("p", { class: "notice" }, d.total ? "No player matches that name." : "No players yet. They appear here after they log in and finish a session."));
    }

    function download() {
      const blob = new Blob(["﻿" + csv(state.data)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: "typelab-players-" + new Date().toISOString().slice(0, 10) + ".csv" });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    const saved = readKey();
    if (saved) load(saved); else keyInput.focus();
    return () => clearInterval(state.timer);
  }

  TL.pages = TL.pages || {};
  TL.pages.admin = { title: "Owner view", mount, _csv: csv };
})(window);
