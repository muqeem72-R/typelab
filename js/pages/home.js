/* TypeLab page: the start page. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt, tile } = TL.ui;
  const S = TL.shared;

  function mode(href, title, text, cta) {
    return h("a", { class: "mode", href }, h("h3", null, title), h("p", null, text), h("span", { class: "mode-cta" }, cta + " →"));
  }

  function mount(main) {
    const st = TL.store.load();
    const plan = S.plan();
    const sessions = st.sessions.length;
    const score = TL.rank.score(st.sessions);
    const tier = TL.rank.tierFor(score);
    const passed = Object.values(st.course).filter((c) => c.stars > 0).length;
    const lessons = TL.lessons.LESSONS.length;
    const p = TL.account.current();
    const rank = p && p.rank && p.rank.rank ? `Rank #${p.rank.rank} of ${p.rank.total}` : null;

    main.append(
      h("div", { class: "home-top" }, h("section", { class: "hero" },
        p ? h("p", { class: "welcome" }, `Welcome back, ${TL.account.firstName()}`,
          h("span", { class: "tier-line" }, TL.social.tierBadge(tier), rank ? h("span", { class: "muted" }, " " + rank) : null)) : null,
        h("h1", null, sessions ? "Keep going." : "Learn to touch type."),
        h("p", { class: "lead" }, "Practice never stops: your letters get faster, new ones unlock while you type, and you see your level climb. Then see how you rank and earn a certificate."),
        h("div", { class: "cta" },
          h("a", { class: "btn primary big", href: "#/practice" }, sessions ? "Continue practising" : "Start practising"),
          h("a", { class: "btn big", href: "#/course" }, passed ? "Continue the course" : "Start the course"))), S.goal()),
      h("div", { class: "tiles" },
        tile("Ranking score", score ? fmt.num(score, 1) + " WPM" : "-", score ? tier.name : "Not ranked yet"),
        tile("Level", `${S.levelOf(plan)} of ${S.MAX_LEVEL}`, `${plan.count} letters unlocked`),
        tile("Lessons passed", `${passed} of ${lessons}`),
        tile("Time practised", fmt.minutes(st.sessions.reduce((a, x) => a + x.ms, 0)))),
      h("div", { class: "modes" },
        mode("#/practice", "Practice", "An endless run that levels up as you type, plus timed, word, sentence and code speed tests.", "Practise"),
        mode("#/course", "Course", `${lessons} lessons from the home row to full sentences, plus a programmer track with every symbol and real code lines.`, passed ? "Continue the course" : "Start lesson 1"),
        mode("#/stats", "Progress", "Your rank on the leaderboard, achievements, certificates, charts and a keyboard heatmap.", "See your progress")),
      h("p", { class: "muted" }, "New to touch typing? Read the ", h("a", { href: "#/learn" }, "short guide"), " first."));
    return () => {};
  }

  TL.pages = TL.pages || {};
  TL.pages.home = { title: "Learn to touch type", mount };
})(window);
