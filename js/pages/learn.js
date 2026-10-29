/* TypeLab page: a short guide to touch typing, with the finger map. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  function mount(main) {
    const kb = TL.ui.keyboard.create({ showHands: true });
    kb.hidden = false;
    // Show every finger's keys in colour and light up the home-row fingers on the hands.
    const hands = kb.el.querySelector(".hands");
    for (const f of hands.querySelectorAll(".fg")) f.classList.add("on");

    const list = (...items) => h("ul", { class: "list" }, ...items.map((t) => h("li", null, t)));

    main.append(
      h("div", { class: "page-head" },
        h("h1", null, "How to touch type"),
        h("p", { class: "lead" }, "Touch typing means typing without looking at the keys. Each finger owns a few keys, and your fingers learn where to go.")),
      h("section", { class: "card" }, h("h2", { class: "sub" }, "Which finger types which key"), kb.el,
        h("p", { class: "muted" }, "Rest your fingers on the home row: A S D F for the left hand and J K L ; for the right. Feel for the small bumps on F and J, and let your thumbs rest on the space bar. After every key, return to the home row.")),
      h("div", { class: "cols" },
        h("div", { class: "col" }, h("section", { class: "card" }, h("h2", { class: "sub" }, "Sit well"),
          list("Sit up straight with your feet flat on the floor.",
            "Keep your elbows at about a right angle and your wrists relaxed and level.",
            "Place the screen at eye level, about an arm's length away.",
            "Take a short break every 20 to 30 minutes.")),
        h("section", { class: "card" }, h("h2", { class: "sub" }, "Practise well"),
          list("Look at the screen, not at your hands.",
            "Aim for accuracy first. Speed follows accuracy. A wrong key never moves on, so find the right key and the caret continues.",
            "Keep a steady rhythm instead of fast bursts and pauses.",
            "Short, regular sessions beat one long session. Type for 5 minutes a day to build a streak; only real typing counts, not just visiting.",
            "Use the finger shown on the hands guide, even if another finger feels quicker.")),
        h("section", { class: "card" }, h("h2", { class: "sub" }, "How the numbers work"),
        list("Speed (WPM): one word is five characters, so 300 correct characters in one minute is 60 WPM. Net speed counts only correct characters.",
          "Raw speed: the same calculation for everything you typed, mistakes included.",
          "Accuracy: the share of key presses that were right the first time.",
          "Consistency: how even your rhythm is. A higher number means steadier typing."))),
        h("div", { class: "col" }, h("section", { class: "card" }, h("h2", { class: "sub" }, "How adaptive practice and levels work"),
        list("You start at level 1 with six common letters. Every word is a real word from daily life, books, newspapers or programming, and uses only those letters.",
          "The run never stops: new words keep arriving while you type, so there is nothing to click between levels.",
          "TypeLab measures how fast and how accurately you type each letter.",
          "When every letter in play reaches your target speed, the next most common letter unlocks. That is a new level, and a short message appears over the text while you keep typing.",
          "The letter you are weakest at appears most often, so your time goes where it helps most.")),
        h("section", { class: "card" }, h("h2", { class: "sub" }, "Rank and certificates"),
        list("Log in with your name and email to join the leaderboard. Others see only your first name, the first letter of your last name and your country.",
          "Everybody who logs in is on the leaderboard, whatever their speed or practice time. You can order it by speed or by practice time.",
          "Pass lessons 1 to 18 to earn the Touch Typing certificate, and all 24 for Touch Typing for Programmers. Each one has a link you can share, and anyone can check that it is genuine.")))),
      h("p", null,
        h("a", { class: "btn primary", href: "#/practice" }, "Start practising"), " ",
        h("a", { class: "btn", href: "#/course" }, "Start the course")));
    return () => {};
  }

  TL.pages = TL.pages || {};
  TL.pages.learn = { title: "How to touch type", mount };
})(window);
