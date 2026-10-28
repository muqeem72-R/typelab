/* TypeLab guided tours. Each section of the app has its own short tour, shown the first time a
   player visits that section: the menu bar, Home, Practice, the Course list, a lesson, Progress
   and Settings. A tour is shown once per player. Finishing it, or skipping it, saves it as done
   (with the rest of the player's data), and it never appears again unless the player restarts the
   tours in Settings. Leaving the page in the middle of a tour does not count as seeing it.

   While a tour is on screen, `TL.tour.active` is true and the typing screens ignore the keyboard. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  // target: a CSS selector for the thing to point at. Steps whose target is not on the page are skipped.
  const STEPS = {
    nav: [
      { target: ".brand", title: "Welcome to TypeLab", text: "This quick tour shows where things are. Click the logo at any time to come back to the start page." },
      { target: "#nav", title: "The main menu", text: "Practice is where you type. Course teaches the keys lesson by lesson. Progress shows your rank, charts and certificates. Learn explains touch typing, and Settings holds your sounds, themes and account." },
      { target: "#themes-btn", title: "Make it yours", text: "Choose a light or dark theme, and a background scene such as a night sky, a sunrise or a beach." },
      { target: "#user", title: "Your account", text: "Your profile, your rank and the log out button are here. Guests see a Log in button instead." },
    ],
    home: [
      { target: ".hero", title: "Start here", text: "Your start page. The big button takes you straight back to practising." },
      { target: ".goal", title: "Your daily streak", text: "Type for 5 minutes a day to keep your streak going. Only real typing counts: opening the app, or typing a few words, does not. Typing more than 5 minutes is great too." },
      { target: ".tiles", title: "Your numbers", text: "Your best speed, your level, the lessons you have passed and how long you have practised." },
      { target: ".modes", title: "Choose where to go", text: "Practice for endless typing, Course for step-by-step lessons, and Progress for your rank and certificates." },
    ],
    practice: [
      { target: '[data-tour="modes"]', title: "Pick a mode", text: "Adaptive is an endless run that gets harder as you improve. Timed, Words, Sentences and Code are speed tests with a fixed length." },
      { target: ".level", title: "Levels without stopping", text: "You start with six letters. When every letter reaches your target speed, a new letter unlocks and a message appears over the text. You never have to stop typing." },
      { target: ".tl-hud", title: "Live numbers", text: "Your speed over the last 15 seconds, your accuracy, the time and your mistakes, updated as you type." },
      { target: ".tl-text", title: "Just start typing", text: "No click needed. A wrong key never moves on: the letter turns red until you type the right key." },
      { target: ".kb-wrap", title: "Keyboard and hands", text: "The next key lights up in the colour of the finger that should press it, and the hands show that finger rising." },
      { target: ".tl-tools", title: "Finish when you like", text: "Press Finish to see your results. Esc starts again, and you can switch the sounds on or off here." },
    ],
    course: [
      { target: ".course-top", title: "Your course", text: "Pass a lesson with 90% accuracy and the speed shown to unlock the next one. This button takes you to the lesson you are up to." },
      { target: ".lessons", title: "The lessons", text: "Each card shows the keys it teaches and your stars. Eighteen lessons teach touch typing, and the programmer track adds every symbol." },
      { target: ".lessons-h", title: "The programmer track", text: "After the first eighteen lessons, these six teach brackets, operators, symbols and real code lines." },
    ],
    lesson: [
      { target: ".page-head", title: "About this lesson", text: "A tip for the keys in this lesson, and what you need to pass it." },
      { target: ".tl-text", title: "Type the text", text: "Start typing when you are ready. Each wrong key waits until you type the right one." },
      { target: ".kb-wrap", title: "Keyboard guide", text: "The keys you have not learned yet are dimmed. The lit key and the hands show what to press next." },
    ],
    progress: [
      { target: '[data-tour="profile"]', title: "Your rank", text: "Your speed tier and where you stand among all typists. Your ranking score is the average of your best three qualifying runs." },
      { target: '[data-tour="board"]', title: "The leaderboard", text: "See the top typists, this week or all time. Your own row is highlighted." },
      { target: '[data-tour="badges"]', title: "Achievements", text: "Earn badges for speed, accuracy, streaks and finishing the course." },
      { target: '[data-tour="certs"]', title: "Certificates", text: "Finish the course to earn a certificate with your name on it, ready to share." },
      { target: ".filters", title: "Your charts", text: "Below are your speed and accuracy charts, a keyboard heatmap and your recent sessions. Use these filters to look at a period or a mode." },
    ],
    settings: [
      { target: '[data-tour="s-typing"]', title: "Typing", text: "Set your target speed. New levels unlock when your letters reach it." },
      { target: '[data-tour="s-sounds"]', title: "Sounds", text: "A soft tick for a right key, a buzz for a wrong key and a harder buzz when you miss the same key twice. Preview them here." },
      { target: '[data-tour="s-look"]', title: "Look", text: "Choose the theme and background scene, and the skin tone of the hands guide." },
      { target: '[data-tour="s-account"]', title: "Account and data", text: "Your name, the leaderboard switch, backups, and a button to see the tours again." },
    ],
  };

  let active = false;
  let queue = [];
  let startTimer = null;
  let current = null;   // the tour on screen: { name, steps, index, nodes, previousFocus }

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function close(done) {
    if (!current) return;
    const c = current;
    current = null;
    document.removeEventListener("keydown", c.onKey, true);
    root.removeEventListener("resize", c.place);
    root.removeEventListener("scroll", c.place, true);
    clearTimeout(c.placeTimer);
    c.nodes.forEach((n) => n.remove());
    active = false;
    document.documentElement.classList.remove("touring");
    if (done) TL.store.markTour(c.name);
    if (c.previousFocus && c.previousFocus.isConnected) c.previousFocus.focus({ preventScroll: true });
    if (done && queue.length) startTimer = setTimeout(() => run(queue.shift()), 350);
  }

  function run(name) {
    const all = STEPS[name] || [];
    const steps = all.filter((s) => visible(document.querySelector(s.target)));
    if (!steps.length) {
      if (queue.length) run(queue.shift());
      return;
    }
    active = true;
    document.documentElement.classList.add("touring");

    const c = { name, steps, index: 0, nodes: [], previousFocus: document.activeElement, placeTimer: null };
    current = c;

    const spot = h("div", { class: "tour-spot", "aria-hidden": "true" });
    const block = h("div", { class: "tour-block", "aria-hidden": "true", onclick: (e) => e.stopPropagation() });
    const count = h("p", { class: "tour-count" });
    const title = h("h2", { class: "tour-title", id: "tour-title" });
    const text = h("p", { class: "tour-text" });
    const skip = h("button", { class: "link-btn", type: "button", onclick: () => close(true) }, "Skip tour");
    const back = h("button", { class: "btn", type: "button", onclick: () => go(c.index - 1) }, "Back");
    const next = h("button", { class: "btn primary", type: "button", onclick: () => (c.index === steps.length - 1 ? close(true) : go(c.index + 1)) });
    const card = h("div", { class: "tour-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-title" },
      count, title, text, h("div", { class: "tour-actions" }, skip, h("span", { class: "tour-spacer" }), back, next));
    c.nodes.push(block, spot, card);
    document.body.append(block, spot, card);

    function place() {
      const step = steps[c.index];
      const target = document.querySelector(step.target);
      if (!target) return;
      const r = target.getBoundingClientRect();
      const pad = 8;
      const vw = document.documentElement.clientWidth;
      const vh = root.innerHeight;
      spot.style.left = Math.max(4, r.left - pad) + "px";
      spot.style.top = Math.max(4, r.top - pad) + "px";
      spot.style.width = Math.min(vw - 8, r.width + pad * 2) + "px";
      spot.style.height = Math.min(vh - 8, r.height + pad * 2) + "px";

      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      let top = r.bottom + pad + 12;
      if (top + ch > vh - 12) top = r.top - pad - 12 - ch;       // not enough room below: go above
      if (top < 12) top = Math.max(12, vh - ch - 12);            // a very tall target: sit at the bottom edge
      const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
      card.style.top = top + "px";
      card.style.left = left + "px";
    }
    c.place = place;

    function go(i) {
      c.index = Math.max(0, Math.min(steps.length - 1, i));
      const step = steps[c.index];
      count.textContent = `Step ${c.index + 1} of ${steps.length}`;
      title.textContent = step.title;
      text.textContent = step.text;
      next.textContent = c.index === steps.length - 1 ? "Done" : "Next";
      back.hidden = c.index === 0;
      const target = document.querySelector(step.target);
      const reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      place();
      clearTimeout(c.placeTimer);
      c.placeTimer = setTimeout(place, 350);   // once the scroll has settled
      next.focus({ preventScroll: true });
    }

    c.onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(true); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); if (c.index < steps.length - 1) go(c.index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); if (c.index > 0) go(c.index - 1); }
      else if (e.key === "Tab") {
        // keep the keyboard inside the tour card
        const items = [...card.querySelectorAll("button:not([hidden])")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      } else if (e.key.length === 1 || e.key === "Backspace") {
        e.preventDefault();   // typing must not reach the page behind the tour
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", c.onKey, true);
    root.addEventListener("resize", place);
    root.addEventListener("scroll", place, true);
    go(0);
  }

  // Starts the tours in `names` one after the other, skipping the ones this player has finished.
  function maybeStart(names) {
    stop();
    queue = names.filter((n) => STEPS[n] && !TL.store.tourDone(n));
    if (!queue.length) return;
    startTimer = setTimeout(() => { if (queue.length) run(queue.shift()); }, 800);
  }

  // Ends whatever is on screen without counting it as seen (used when the page changes).
  function stop() {
    clearTimeout(startTimer);
    queue = [];
    close(false);
  }

  TL.tour = { STEPS, maybeStart, stop, get active() { return active; } };
})(window);
