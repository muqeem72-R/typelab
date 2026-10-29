/* TypeLab Progress, the social part: your rank card, the leaderboard, achievements and certificates.
   Each function returns a card for the Progress page. Anything that needs the server fills itself in
   when the answer arrives, and says so plainly when there is no server. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt } = TL.ui;
  const R = TL.rank;
  const acct = TL.account;

  const tierBadge = (tier) => h("span", { class: "tier tier-" + tier.id }, tier.name);

  function promo(title, text) {
    return h("section", { class: "card promo" },
      h("h3", { class: "sub" }, title), h("p", null, text),
      h("a", { class: "btn primary", href: "#/login" }, "Log in"));
  }

  // ---- rank card --------------------------------------------------------------------------------

  // Where the player stands among everybody, by speed and by practice time. There is no minimum for either:
  // a slow speed or a short practice still has a place.
  function profileCard() {
    if (!acct.loggedIn()) {
      const card = promo("Your rank", "Log in to see where you stand among other typists and to earn a certificate. Your name and email are all it takes.");
      card.setAttribute("data-tour", "profile");
      return card;
    }
    const st = TL.store.load();
    const p = acct.current();
    const speed = R.topSpeed(st.sessions);
    const tier = R.tierFor(speed);
    const next = R.nextTier(speed);
    const rankBox = h("div", { class: "rank-box", "aria-live": "polite" });

    function drawRank(info, note) {
      rankBox.textContent = "";
      const stat = (label, value, sub) => h("div", { class: "rank-stat" }, h("span", { class: "rank-l" }, label), h("span", { class: "rank-v" }, value), sub ? h("span", { class: "rank-s" }, sub) : null);
      const group = (title, ...stats) => h("div", { class: "rank-group" }, h("p", { class: "rank-h" }, title), h("div", { class: "rank-row" }, ...stats));
      if (!info || !(info.rank || (info.time && info.time.rank))) {
        rankBox.append(h("p", { class: "muted" }, note || "Checking your rank..."));
        return;
      }
      const typed = (minutes) => fmt.duration(minutes * 60000);
      const blocks = [];
      if (info.rank) {
        blocks.push(group("By speed",
          stat("All time", "#" + info.rank, `of ${info.total} typists, best ${fmt.num(info.score, 1)} WPM`),
          info.week && info.week.rank ? stat("This week", "#" + info.week.rank, `of ${info.week.total} typists, ${fmt.num(info.week.score, 1)} WPM`) : stat("This week", "-", "no run this week yet")));
      }
      if (info.time && info.time.rank) {
        blocks.push(group("By practice time",
          stat("All time", "#" + info.time.rank, `of ${info.time.total} typists, ${typed(info.time.score)} typed`),
          info.timeWeek && info.timeWeek.rank ? stat("This week", "#" + info.timeWeek.rank, `of ${info.timeWeek.total} typists, ${typed(info.timeWeek.score)}`) : stat("This week", "-", "no typing yet this week")));
      }
      rankBox.append(...blocks);
    }

    const cached = p.rank ? { ...p.rank } : null;
    drawRank(cached, "Checking your rank...");
    acct.sync().then((r) => {
      if (!rankBox.isConnected) return;
      const fresh = acct.current().rank;
      if (r.ok && fresh) drawRank(fresh, "");
      else if (r.ok && !fresh) drawRank(null, p.board === false ? "You are hidden from the leaderboard. Turn it back on in Settings to be listed." : "Your numbers will appear here in a moment.");
      else if (!cached) drawRank(null, "The leaderboard is not reachable right now. Your rank will appear when it is.");
    });

    return h("section", { class: "card profile", "data-tour": "profile" },
      h("div", { class: "profile-top" },
        TL.ui.avatar({ first: p.first, last: p.last, photo: p.photo, initials: p.account ? null : acct.initials() }, true),
        h("div", null,
          h("h3", { class: "profile-name" }, p.name),
          p.uid ? h("div", { class: "uid" }, p.uid) : null,
          h("div", null, tierBadge(tier), h("span", { class: "muted score" }, speed ? ` ${fmt.num(speed, 1)} WPM best speed` : " no speed yet: type something to set one")))),
      next && speed ? h("div", { class: "tier-next" },
        h("div", { class: "meter", role: "img", "aria-label": `${fmt.num(next.need, 1)} WPM to ${next.tier.name}` },
          (() => { const f = h("span", { class: "meter-fill" }); f.style.width = Math.max(4, ((speed - tier.min) / (next.tier.min - tier.min)) * 100) + "%"; return f; })()),
        h("p", { class: "muted" }, `${fmt.num(next.need, 1)} WPM to reach ${next.tier.name}`)) : null,
      rankBox,
      h("details", { class: "how" },
        h("summary", null, "How is my rank worked out?"),
        h("p", null, "Everybody who has logged in is on the leaderboard, whatever their speed or practice time. There is no minimum: a slow speed or a short practice still has a place."),
        h("p", null, "Speed is your best speed in any run (practice, tests or lessons). Practice time is how long you have really typed: the seconds between keys, with breaks left out. You can order the table by either one."),
        h("p", null, "Your speed tier (Beginner to Legend) follows your best speed. Speeds and times are reported by your browser, so the leaderboard is for fun.")));
  }

  // ---- leaderboard ------------------------------------------------------------------------------

  // One table, everybody in it. A filter orders it by speed or by practice time; the other number is always shown beside it.
  function leaderboardCard() {
    let scope = "all";
    let by = "speed";
    const body = h("div", { class: "board-body", "aria-live": "polite" });
    const kinds = h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Order the leaderboard by" });
    const tabs = h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Leaderboard period" });
    const refresh = h("button", { class: "btn small", type: "button", onclick: () => load() }, "Refresh");

    function drawTabs() {
      kinds.textContent = "";
      for (const [value, label] of [["speed", "Speed"], ["time", "Practice time"]]) {
        kinds.append(h("button", {
          class: "seg" + (by === value ? " on" : ""), type: "button", role: "radio", "aria-checked": String(by === value),
          onclick: () => { by = value; drawTabs(); load(); },
        }, label));
      }
      tabs.textContent = "";
      for (const [value, label] of [["all", "All time"], ["week", "This week"]]) {
        tabs.append(h("button", {
          class: "seg" + (scope === value ? " on" : ""), type: "button", role: "radio", "aria-checked": String(scope === value),
          onclick: () => { scope = value; drawTabs(); load(); },
        }, label));
      }
    }

    const speedText = (v) => (v > 0 ? fmt.num(v, 1) : "-");
    const timeText = (m) => (m > 0 ? fmt.duration(m * 60000) : "-");
    const row = (r) => h("tr", { class: r.you ? "you" : "" },
      h("td", { class: "r-rank" }, "#" + r.rank),
      h("th", { scope: "row" }, r.name, r.you ? h("span", { class: "you-tag" }, " you") : null),
      h("td", null, tierBadge(R.tierFor(r.speed))),
      h("td", { class: "r-num" + (by === "speed" ? " ord" : "") }, speedText(r.speed)),
      h("td", { class: "r-num" + (by === "time" ? " ord" : "") }, timeText(r.minutes)),
      h("td", { class: "r-num" }, r.acc > 0 ? r.acc + "%" : "-"),
      h("td", { class: "r-num" }, r.streak ? r.streak + " d" : "-"),
      h("td", { class: "r-num" }, String(r.sessions)));
    const HEADS = ["Rank", "Typist", "Tier", "Speed (WPM)", "Practice time", "Accuracy", "Streak", "Runs"];

    function drawBoard(d) {
      body.textContent = "";
      if (!d.total) {
        body.append(h("p", { class: "muted" }, "Nobody is here yet. Log in and type something to be the first."));
        return;
      }
      const rows = [...d.top.map(row)];
      if (d.around.length) rows.push(h("tr", { class: "gap" }, h("td", { colspan: String(HEADS.length), "aria-hidden": "true" }, "⋮")), ...d.around.map(row));
      body.append(
        h("div", { class: "table-wrap" }, h("table", { class: "board" },
          h("thead", null, h("tr", null, ...HEADS.map((t, i) => h("th", { scope: "col", class: (i === 3 && by === "speed") || (i === 4 && by === "time") ? "ord" : "" }, t)))),
          h("tbody", null, ...rows))),
        h("p", { class: "muted fine" }, `${d.total} typist${d.total === 1 ? "" : "s"}${scope === "week" ? " this week (" + d.week + ")" : " in all"}, ordered by ${by === "time" ? "practice time" : "speed"}. Everybody is listed, whatever their numbers. A player's numbers reach the board when they finish a run, and about every three minutes while they are on the site. Names are shortened to protect privacy.`));
    }

    // `quiet` redraws only when the answer arrives, so a refresh does not flash "Loading".
    async function load(quiet) {
      if (!quiet) {
        body.textContent = "";
        body.append(h("p", { class: "muted" }, "Loading the leaderboard..."));
      }
      const r = await acct.board(scope, by);
      if (!body.isConnected) return;
      if (r.ok) drawBoard(r.data);
      else if (!quiet) {
        body.textContent = "";
        body.append(h("p", { class: "muted" }, r.offline
          ? "The leaderboard is not reachable right now. This happens when the site is opened from a file or the server is not set up yet."
          : "The leaderboard could not be loaded. Please try again in a moment."));
      }
    }

    drawTabs();
    load();
    // The player's own numbers are sent when this page opens. Once they have arrived, show the board again
    // so the player's own row (and the rows around it) are on it.
    acct.settled().then(() => { if (body.isConnected && acct.loggedIn()) load(true); });
    return h("section", { class: "card", "data-tour": "board" },
      h("div", { class: "card-head" },
        h("h3", { class: "sub" }, "Leaderboard"),
        h("div", { class: "row-actions tight" }, h("span", { class: "muted fine" }, "Order by"), kinds, tabs, refresh)),
      body);
  }

  // ---- achievements -----------------------------------------------------------------------------

  function achievementsCard() {
    const st = TL.store.load();
    const list = R.achievements(st, TL.store.streak());
    const got = list.filter((a) => a.earned).length;
    return h("section", { class: "card", "data-tour": "badges" },
      h("div", { class: "card-head" }, h("h3", { class: "sub" }, "Achievements"), h("span", { class: "muted" }, `${got} of ${list.length} earned`)),
      h("ul", { class: "badges" }, ...list.map((a) => h("li", { class: "badge" + (a.earned ? " earned" : ""), title: a.desc },
        h("span", { class: "badge-i", "aria-hidden": "true" }, a.earned ? "★" : "☆"),
        h("span", { class: "badge-t" }, a.title),
        h("span", { class: "badge-d" }, a.desc),
        h("span", { class: "sr-only" }, a.earned ? "Earned" : "Not earned yet")))));
  }

  // ---- certificates -----------------------------------------------------------------------------

  function certificatesCard() {
    const st = TL.store.load();
    const tiers = TL.certificate.status(st.course, R.lessonRun);
    const status = h("p", { class: "muted", role: "status" });

    const panel = (t) => {
      const fillEl = h("span", { class: "meter-fill" });
      fillEl.style.width = Math.round((t.passed / t.lessons) * 100) + "%";
      const issued = st.certs[t.id];
      let action;
      if (issued) action = h("a", { class: "btn primary", href: "#/certificate/" + issued.code }, "View and share");
      else if (t.done && acct.loggedIn()) {
        action = h("button", { class: "btn primary", type: "button", onclick: async (e) => {
          e.target.disabled = true;
          status.textContent = "Creating your certificate...";
          const r = await acct.issueCertificate(t.id);
          if (r.ok) location.hash = "#/certificate/" + r.code;
          else { e.target.disabled = false; status.textContent = "Sorry, the certificate could not be created. Please try again."; }
        } }, "Get my certificate");
      } else if (t.done) action = h("a", { class: "btn primary", href: "#/login" }, "Log in to get it");
      else action = h("a", { class: "btn", href: "#/course" }, "Continue the course");
      return h("div", { class: "cert-tier" + (t.done ? " done" : "") },
        h("div", { class: "cert-seal", "aria-hidden": "true" }, t.done ? "★" : "☆"),
        h("div", { class: "cert-info" },
          h("h4", null, t.title),
          h("p", { class: "muted" }, t.id === "core" ? "Pass lessons 1 to 18." : "Pass all 24 lessons, including the programmer track."),
          h("div", { class: "meter", role: "img", "aria-label": `${t.passed} of ${t.lessons} lessons passed` }, fillEl),
          h("p", { class: "muted fine" }, `${t.passed} of ${t.lessons} lessons passed`)),
        h("div", { class: "cert-action" }, action));
    };

    return h("section", { class: "card", "data-tour": "certs" },
      h("h3", { class: "sub" }, "Certificates"),
      h("p", { class: "muted" }, "Finish the course to earn a certificate with your name, speed and accuracy. You can download it, print it or share a link that anyone can open and verify."),
      ...tiers.map(panel), status);
  }

  TL.social = { profileCard, leaderboardCard, achievementsCard, certificatesCard, tierBadge };
})(window);
