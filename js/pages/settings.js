/* TypeLab page: settings, theme, sounds, and backup / restore / reset of the saved data. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  function mount(main) {
    const st = TL.store.load();
    const s = st.settings;
    const status = h("p", { class: "muted", role: "status" });
    const say = (text) => { status.textContent = text; };

    const save = () => TL.store.save();
    const row = (label, hint, control, id) => h("div", { class: "field" },
      h("label", { for: id }, label, hint ? h("span", { class: "hint" }, hint) : null), control);

    const number = (id, key, min, max) => h("input", {
      id, type: "number", min, max, value: s[key], inputmode: "numeric",
      onchange: (e) => { const v = Math.round(Number(e.target.value)); s[key] = Math.min(max, Math.max(min, Number.isFinite(v) ? v : s[key])); e.target.value = s[key]; save(); say("Saved."); },
    });
    const choice = (id, key, options, after) => h("select", { id, onchange: (e) => { s[key] = isNaN(Number(options[0][0])) ? e.target.value : Number(e.target.value); save(); if (after) after(); say("Saved."); } },
      ...options.map(([v, t]) => h("option", { value: v, selected: String(s[key]) === String(v) ? "" : null }, t)));
    const toggle = (id, key, label, hint, after) => h("div", { class: "field check-field" },
      h("label", { class: "check", for: id }, h("input", { id, type: "checkbox", checked: s[key] ? "" : null, onchange: (e) => { s[key] = e.target.checked; save(); if (after) after(); say("Saved."); } }), label, hint ? h("span", { class: "hint" }, hint) : null));

    const volume = h("input", {
      id: "f-volume", type: "range", min: 0, max: 100, step: 5, value: s.volume,
      "aria-valuetext": s.volume + " percent",
      oninput: (e) => { s.volume = Number(e.target.value); e.target.setAttribute("aria-valuetext", s.volume + " percent"); },
      onchange: () => { save(); TL.ui.sound.play("ok", s.volume); say("Saved."); },
    });
    const hear = (kind, label) => h("button", { class: "btn", type: "button", onclick: () => TL.ui.sound.play(kind, s.volume) }, label);

    function download() {
      const blob = new Blob([TL.store.exportJson()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: `typelab-backup-${TL.store.dayKey(new Date())}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Backup downloaded.");
    }

    function restore(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          TL.store.importJson(String(reader.result));
          say("Backup restored. Reloading the page...");
          setTimeout(() => location.reload(), 600);
        } catch (err) { say("That file could not be used: " + err.message); }
      };
      reader.readAsText(file);
    }

    // The login profile: who you are, the leaderboard switch, removal, and logging out.
    function accountBlock() {
      const p = TL.account.current();
      if (!p) {
        return h("div", { class: "account" },
          h("p", null, "You are using TypeLab as a guest. Log in with your name and email to get a rank on the leaderboard and a shareable certificate. Your guest progress is copied into your profile."),
          h("a", { class: "btn primary", href: "#/login" }, "Log in"));
      }
      const masked = p.email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
      const boardStatus = h("p", { class: "muted", role: "status" });
      const visible = h("input", { id: "f-board", type: "checkbox", checked: p.board !== false ? "" : null, onchange: async (e) => {
        await TL.account.setBoardVisible(e.target.checked);
        boardStatus.textContent = e.target.checked ? "You are on the leaderboard." : "You are hidden from the leaderboard.";
      } });
      return h("div", { class: "account" },
        h("div", { class: "user-card" },
          h("span", { class: "avatar big", "aria-hidden": "true" }, TL.account.initials()),
          h("div", null, h("strong", null, p.name), h("div", { class: "muted" }, masked, " · verified with an email code"))),
        h("div", { class: "field check-field" }, h("label", { class: "check", for: "f-board" }, visible, "Show me on the leaderboard",
          h("span", { class: "hint" }, `Others see "${p.name.split(" ")[0]}${p.name.split(" ").length > 1 ? " " + [...p.name.split(" ").pop()][0].toUpperCase() + "." : ""}" and your speed, never your email.`))),
        boardStatus,
        h("p", { class: "muted" }, "TypeLab also keeps how long you have been on the site and how long you have really typed, with your results, so the owner of the site can see how people use it. \"Delete my leaderboard entry\" removes all of it from the server and nothing more is sent until you join again."),
        h("div", { class: "row-actions" },
          h("button", { class: "btn", type: "button", onclick: async () => {
            const r = await TL.account.removeFromBoard();
            if (r.ok) visible.checked = false;
            boardStatus.textContent = r.ok ? "Your entry was deleted from the leaderboard. Switch \"Show me on the leaderboard\" on to join again."
              : r.offline ? "The server could not be reached. Please try again later." : "You are not on the leaderboard.";
          } }, "Delete my leaderboard entry"),
          h("button", { class: "btn", type: "button", onclick: () => { TL.account.logout(); location.hash = "#/login"; location.reload(); } }, "Log out")));
    }

    const resetBox = h("div", { class: "reset" });
    function resetStep(confirming) {
      resetBox.textContent = "";
      if (!confirming) resetBox.append(h("button", { class: "btn danger", type: "button", onclick: () => resetStep(true) }, "Reset all data"));
      else resetBox.append(
        h("span", null, "This deletes all sessions, letters and lesson stars in this browser. "),
        h("button", { class: "btn danger", type: "button", onclick: () => { TL.store.reset(); say("All data deleted. Reloading..."); setTimeout(() => location.reload(), 500); } }, "Yes, delete everything"),
        h("button", { class: "btn", type: "button", onclick: () => resetStep(false) }, "Cancel"));
    }
    resetStep(false);

    main.append(
      h("div", { class: "page-head" }, h("h1", null, "Settings"), h("p", { class: "lead" }, "Changes are saved as soon as you make them.")),
      status,
      h("section", { class: "card", "data-tour": "s-typing" }, h("h2", { class: "sub" }, "Typing"),
        row("Target speed (WPM)", "New levels unlock when every letter reaches it", number("f-target", "targetWpm", 10, 150), "f-target"),
        h("p", { class: "muted" }, "Capitals, punctuation, numbers and symbols for the adaptive run are switched on the Practice page. A wrong key never moves on: the caret waits until you type the right key.")),
      h("section", { class: "card", "data-tour": "s-sounds" }, h("h2", { class: "sub" }, "Sounds"),
        toggle("f-sound", "sound", "Key sounds", "A soft tick for a right key, a low buzz for a wrong key, and a harder double buzz when you miss the same key twice in a row."),
        row("Volume", "", volume, "f-volume"),
        h("div", { class: "sound-test" }, hear("ok", "Hear: right key"), hear("wrong", "Hear: wrong key"), hear("wrong2", "Hear: missed twice"), hear("done", "Hear: finished"))),
      h("section", { class: "card", "data-tour": "s-look" }, h("h2", { class: "sub" }, "Look"),
        h("p", { class: "muted" }, "Pick a colour mode and a background scene. Dark mode has night scenes and light mode has daytime scenes, and each mode remembers its own."),
        TL.themes.picker(),
        h("div", { class: "field" }, h("label", { for: "f-tone" }, "Hands skin tone", h("span", { class: "hint" }, "Only changes the hands guide")),
          choice("f-tone", "handTone", [["fair", "Fair"], ["light", "Light"], ["medium", "Medium"], ["brown", "Brown"], ["deep", "Deep"]], () => TL.app.applySkin())),
        toggle("f-kb", "showKeyboard", "Show the virtual keyboard"),
        toggle("f-hands", "showHands", "Show the hands guide", "Shows which finger presses the next key")),
      h("section", { class: "card" }, h("h2", { class: "sub" }, "Goals and course"),
        h("p", { class: "muted" }, "Your streak grows by one for every day you type for 5 minutes. Only real typing counts, not just opening the app. Typing more than 5 minutes is great, but it does not count as extra days."),
        toggle("f-unlock", "unlockAllLessons", "Unlock all course lessons")),
      h("section", { class: "card", "data-tour": "s-account" }, h("h2", { class: "sub" }, "Account and data"),
        accountBlock(),
        h("h3", { class: "sub-h2" }, "Your data"),
        h("p", { class: "muted" }, "Your sessions and settings are stored in this browser. Download a backup to move them to another device."),
        h("div", { class: "row-actions" },
          h("button", { class: "btn", type: "button", onclick: download }, "Download backup"),
          h("label", { class: "btn file" }, "Restore backup", h("input", { type: "file", accept: "application/json,.json", onchange: restore }))),
        h("h3", { class: "sub-h2" }, "Guided tours"),
        h("p", { class: "muted" }, "Each part of TypeLab shows a short tour the first time you visit it. Want to see them again?"),
        h("button", { class: "btn", type: "button", onclick: () => { TL.store.resetTours(); say("The tours will show again as you visit each part."); setTimeout(() => { location.hash = "#/"; location.reload(); }, 900); } }, "Show the tours again"),
        h("h3", { class: "sub-h2" }, "Reset"),
        resetBox,
        TL.store.blocked ? h("p", { class: "banner warn" }, "Your browser is blocking storage, so progress cannot be saved.") : null));
    return () => {};
  }

  TL.pages = TL.pages || {};
  TL.pages.settings = { title: "Settings", mount };
})(window);
