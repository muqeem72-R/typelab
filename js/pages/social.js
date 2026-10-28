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

  function profileCard() {
    if (!acct.loggedIn()) {
      const card = promo("Your rank", "Log in to see where you stand among other typists and to earn a certificate. Your name and email are all it takes.");
      card.setAttribute("data-tour", "profile");
      return card;
    }
    const st = TL.store.load();
    const p = acct.current();
    const score = R.score(st.sessions);
    const tier = R.tierFor(score);
    const next = R.nextTier(score);
    const rankBox = h("div", { class: "rank-box", "aria-live": "polite" });

    // Two ranks: by real practice time (it moves as soon as you practise) and by speed (it needs a ranked run).
    function drawRank(info, note) {
      rankBox.textContent = "";
      const stat = (label, value, sub) => h("div", { class: "rank-stat" }, h("span", { class: "rank-l" }, label), h("span", { class: "rank-v" }, value), sub ? h("span", { class: "rank-s" }, sub) : null);
      const group = (title, ...stats) => h("div", { class: "rank-group" }, h("p", { class: "rank-h" }, title), h("div", { class: "rank-row" }, ...stats));
      const typed = (minutes) => fmt.duration(minutes * 60000);
      const blocks = [];

      if (info && info.time && info.time.rank) {
        blocks.push(group("Practice time (real typing)",
          stat("All time", "#" + info.time.rank, `of ${info.time.total} typists, ${typed(info.time.score)} typed`),
          info.timeWeek && info.timeWeek.rank ? stat("This week", "#" + info.timeWeek.rank, `of ${info.timeWeek.total} typists, ${typed(info.timeWeek.score)}`) : stat("This week", "-", "no typing yet this week")));
      } else if (note !== "Checking your rank...") {
        blocks.push(h("div", { class: "rank-group" }, h("p", { class: "rank-h" }, "Practice time (real typing)"),
          h("p", { class: "muted" }, p.board === false ? "You are hidden from the leaderboard. Turn it back on in Settings to get a rank." : "Practise for a minute and your practice-time rank appears here. It updates when you finish a run and about every three minutes while you are on the site.")));
      }

      if (!score) {
        blocks.push(h("div", { class: "rank-group" }, h("p", { class: "rank-h" }, "Speed rank"),
          h("p", { class: "muted" }, "No speed score yet. Practice alone does not make one until you have 18 letters unlocked. To get one now, finish a Timed, Words or Sentences test of 20 seconds or more with 92% accuracy."),
          h("a", { class: "btn small", href: "#/practice" }, "Take a test in Practice")));
      } else if (info && info.rank) {
        blocks.push(group("Speed",
          stat("All time", "#" + info.rank, `of ${info.total} typists, top ${info.percent}%`),
          info.week && info.week.rank ? stat("This week", "#" + info.week.rank, `of ${info.week.total} typists`) : stat("This week", "-", "no ranked run yet this week")));
      } else {
        blocks.push(h("p", { class: "muted" }, note || "Checking your rank..."));
      }
      rankBox.append(...blocks);
    }

    const cached = p.rank ? { ...p.rank } : null;
    drawRank(cached, "Checking your rank...");
    acct.sync().then((r) => {
      if (!rankBox.isConnected) return;
      const fresh = acct.current().rank;
      if (r.ok && fresh) drawRank(fresh, "");
      else if (r.ok && !fresh) drawRank(null, p.board === false ? "You are hidden from the leaderboard. Turn it back on in Settings to get a rank." : "Your first ranked run will put you on the leaderboard.");
      else if (!cached) drawRank(null, "The leaderboard is not reachable right now. Your rank will appear when it is.");
    });

    return h("section", { class: "card profile", "data-tour": "profile" },
      h("div", { class: "profile-top" },
        h("span", { class: "avatar big", "aria-hidden": "true" }, acct.initials()),
        h("div", null,
          h("h3", { class: "profile-name" }, p.name),
          h("div", null, tierBadge(tier), h("span", { class: "muted score" }, score ? ` ${fmt.num(score, 1)} WPM ranking score` : " no ranking score yet")))),
      next && score ? h("div", { class: "tier-next" },
        h("div", { class: "meter", role: "img", "aria-label": `${fmt.num(next.need, 1)} WPM to ${next.tier.name}` },
          (() => { const f = h("span", { class: "meter-fill" }); f.style.width = Math.max(4, ((score - tier.min) / (next.tier.min - tier.min)) * 100) + "%"; return f; })()),
        h("p", { class: "muted" }, `${fmt.num(next.need, 1)} WPM to reach ${next.tier.name}`)) : null,
      rankBox,
      h("details", { class: "how" },
        h("summary", null, "How is my rank worked out?"),
        h("p", null, "Practice time is how long you have really typed (the seconds between keys, with breaks left out). It counts from your first minute, so a long practice shows on the leaderboard straight away."),
        h("p", null, "Your speed score is the average of your best three runs. A run counts when it lasts at least 20 seconds, has 92% accuracy or better and uses everyday text: the Timed, Words and Sentences tests, or adaptive practice once 18 or more letters are unlocked. Course lessons and code tests are not ranked. Speeds are reported by your browser, so the leaderboard is for fun.")));
  }

  // ---- leaderboard ------------------------------------------------------------------------------

  function leaderboardCard() {
    let scope = "all";
    let by = "time";   // practice time first: it is the board that moves with every practice
    const body = h("div", { class: "board-body", "aria-live": "polite" });
    const kinds = h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Leaderboard kind" });
    const tabs = h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Leaderboard period" });
    const refresh = h("button", { class: "btn small", type: "button", onclick: () => load() }, "Refresh");

    function drawTabs() {
      kinds.textContent = "";
      for (const [value, label] of [["time", "Practice time"], ["speed", "Speed"]]) {
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

    const rankName = (r) => [h("td", { class: "r-rank" }, "#" + r.rank), h("th", { scope: "row" }, r.name, r.you ? h("span", { class: "you-tag" }, " you") : null)];
    const row = (r) => (by === "time"
      ? h("tr", { class: r.you ? "you" : "" }, ...rankName(r),
        h("td", { class: "r-num" }, fmt.duration(r.minutes * 60000)),
        h("td", { class: "r-num" }, r.streak ? r.streak + " d" : "-"),
        h("td", { class: "r-num" }, String(r.days)),
        h("td", { class: "r-num" }, String(r.sessions)))
      : h("tr", { class: r.you ? "you" : "" }, ...rankName(r),
        h("td", null, tierBadge(R.tierFor(r.score))),
        h("td", { class: "r-num" }, fmt.num(r.score, 1)),
        h("td", { class: "r-num" }, r.acc + "%"),
        h("td", { class: "r-num" }, String(r.sessions))));
    const HEADS = { speed: ["Rank", "Typist", "Tier", "WPM", "Accuracy", "Runs"], time: ["Rank", "Typist", "Practice time", "Streak", "5-min days", "Runs"] };

    function drawBoard(d) {
      body.textContent = "";
      if (!d.total) {
        body.append(h("p", { class: "muted" }, by === "time"
          ? (scope === "week" ? "Nobody has practised this week yet. Be the first." : "Nobody is here yet. Practise for a minute to be the first.")
          : (scope === "week" ? "Nobody has a ranked run this week yet. Be the first." : "The speed board is empty. Finish a Timed, Words or Sentences test to be the first.")));
        return;
      }
      const rows = [...d.top.map(row)];
      if (d.around.length) rows.push(h("tr", { class: "gap" }, h("td", { colspan: "6", "aria-hidden": "true" }, "⋮")), ...d.around.map(row));
      body.append(
        h("div", { class: "table-wrap" }, h("table", { class: "board" },
          h("thead", null, h("tr", null, ...HEADS[by].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", null, ...rows))),
        h("p", { class: "muted fine" }, `${d.total} typist${d.total === 1 ? "" : "s"}${scope === "week" ? " this week (" + d.week + ")" : ""}. ${by === "time" ? "Practice time is real typing time, with breaks left out. " : "The speed score is the average of the best three ranked runs. "}A player's numbers reach the board when they finish a run, and about every three minutes while they are on the site. Names are shortened to protect privacy.`));
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
      h("div", { class: "card-head" }, h("h3", { class: "sub" }, "Leaderboard"), h("div", { class: "row-actions tight" }, kinds, tabs, refresh)),
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
