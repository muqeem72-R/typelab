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

    function drawRank(info, note) {
      rankBox.textContent = "";
      const stat = (label, value, sub) => h("div", { class: "rank-stat" }, h("span", { class: "rank-l" }, label), h("span", { class: "rank-v" }, value), sub ? h("span", { class: "rank-s" }, sub) : null);
      if (!score) {
        rankBox.append(h("p", { class: "muted" }, "You are not ranked yet. Finish a Timed, Words or Sentences test of 20 seconds or more with 92% accuracy, or practise with 18 letters unlocked."));
      } else if (info && info.rank) {
        rankBox.append(
          stat("All time", "#" + info.rank, `of ${info.total} typists, top ${info.percent}%`),
          info.week && info.week.rank ? stat("This week", "#" + info.week.rank, `of ${info.week.total} typists`) : stat("This week", "-", "no ranked run yet this week"));
      } else {
        rankBox.append(h("p", { class: "muted" }, note || "Checking your rank..."));
      }
    }

    const cached = p.rank && p.rank.rank ? { ...p.rank, week: p.rank.week } : null;
    drawRank(cached, "Checking your rank...");
    acct.sync().then((r) => {
      if (!rankBox.isConnected) return;
      const fresh = acct.current().rank;
      if (r.ok && fresh && fresh.rank) drawRank({ ...fresh, week: fresh.week }, "");
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
        h("p", null, "Your ranking score is the average of your best three runs. A run counts when it lasts at least 20 seconds, has 92% accuracy or better and uses everyday text: the Timed, Words and Sentences tests, or adaptive practice once 18 or more letters are unlocked. Course lessons and code tests are not ranked. Speeds are reported by your browser, so the leaderboard is for fun.")));
  }

  // ---- leaderboard ------------------------------------------------------------------------------

  function leaderboardCard() {
    let scope = "all";
    const body = h("div", { class: "board-body", "aria-live": "polite" });
    const tabs = h("div", { class: "seg-group", role: "radiogroup", "aria-label": "Leaderboard period" });
    const refresh = h("button", { class: "btn small", type: "button", onclick: () => load() }, "Refresh");

    function drawTabs() {
      tabs.textContent = "";
      for (const [value, label] of [["all", "All time"], ["week", "This week"]]) {
        tabs.append(h("button", {
          class: "seg" + (scope === value ? " on" : ""), type: "button", role: "radio", "aria-checked": String(scope === value),
          onclick: () => { scope = value; drawTabs(); load(); },
        }, label));
      }
    }

    const row = (r) => h("tr", { class: r.you ? "you" : "" },
      h("td", { class: "r-rank" }, "#" + r.rank),
      h("th", { scope: "row" }, r.name, r.you ? h("span", { class: "you-tag" }, " you") : null),
      h("td", null, tierBadge(R.tierFor(r.score))),
      h("td", { class: "r-num" }, fmt.num(r.score, 1)),
      h("td", { class: "r-num" }, r.acc + "%"),
      h("td", { class: "r-num" }, String(r.sessions)));

    function drawBoard(d) {
      body.textContent = "";
      if (!d.total) {
        body.append(h("p", { class: "muted" }, scope === "week" ? "Nobody has a ranked run this week yet. Be the first." : "The leaderboard is empty. Finish a ranked run to be the first."));
        return;
      }
      const rows = [...d.top.map(row)];
      if (d.around.length) rows.push(h("tr", { class: "gap" }, h("td", { colspan: "6", "aria-hidden": "true" }, "⋮")), ...d.around.map(row));
      body.append(
        h("div", { class: "table-wrap" }, h("table", { class: "board" },
          h("thead", null, h("tr", null, ...["Rank", "Typist", "Tier", "WPM", "Accuracy", "Runs"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", null, ...rows))),
        h("p", { class: "muted fine" }, `${d.total} ranked typist${d.total === 1 ? "" : "s"}${scope === "week" ? " this week (" + d.week + ")" : ""}. Names are shortened to protect privacy.`));
    }

    // `quiet` redraws only when the answer arrives, so a refresh does not flash "Loading".
    async function load(quiet) {
      if (!quiet) {
        body.textContent = "";
        body.append(h("p", { class: "muted" }, "Loading the leaderboard..."));
      }
      const r = await acct.board(scope);
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
      h("div", { class: "card-head" }, h("h3", { class: "sub" }, "Leaderboard"), h("div", { class: "row-actions tight" }, tabs, refresh)),
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
