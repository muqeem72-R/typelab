/* TypeLab page: the course. A map of lessons, and one lesson screen with its own pass mark. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;
  const S = TL.shared;
  const LS = TL.lessons;

  const record = (st, id) => st.course[id] || { stars: 0, wpm: 0, acc: 0, tries: 0 };
  const isOpen = (st, lesson) =>
    lesson.id === 1 || st.settings.unlockAllLessons || record(st, lesson.id - 1).stars > 0;

  function keysLabel(lesson) {
    if (lesson.capitals) return "Shift";
    if (lesson.sentences) return "All keys";
    if (lesson.code) return "Code lines";
    if (!lesson.keys) return "camelCase, snake_case";
    return [...lesson.keys].map((k) => h("kbd", null, k)).flatMap((k, i) => (i ? [" ", k] : [k]));
  }

  function map(main) {
    const st = TL.store.load();
    const done = LS.LESSONS.filter((l) => record(st, l.id).stars > 0).length;
    const next = LS.LESSONS.find((l) => record(st, l.id).stars === 0 && isOpen(st, l));

    const cards = LS.LESSONS.flatMap((lesson) => {
      const rec = record(st, lesson.id);
      const open = isOpen(st, lesson);
      const body = [
        h("span", { class: "lesson-n" }, String(lesson.id)),
        h("span", { class: "lesson-t" }, lesson.title),
        h("span", { class: "lesson-k" }, ...[].concat(keysLabel(lesson))),
        h("span", { class: "lesson-s" }, S.stars(rec.stars), h("span", { class: "muted" }, rec.tries ? `Best ${Math.round(rec.wpm)} WPM` : open ? `Goal ${lesson.minWpm} WPM` : "Locked")),
      ];
      const card = open
        ? h("a", { class: "lesson" + (rec.stars ? " passed" : ""), href: "#/course/" + lesson.id }, ...body)
        : h("div", { class: "lesson locked", "aria-disabled": "true", title: `Pass lesson ${lesson.id - 1} to unlock` }, ...body);
      // The programmer track starts after the sentences lesson, with a heading of its own.
      return lesson.coder && !LS.LESSONS[lesson.id - 2].coder
        ? [h("h2", { class: "lessons-h" }, "Programmer track", h("span", { class: "hint" }, "Symbols, brackets, operators, names and real code lines")), card]
        : [card];
    });

    main.append(
      h("div", { class: "page-head" },
        h("h1", null, "Course"),
        h("p", { class: "lead" }, `${LS.LESSONS.length} short lessons take you from the home row to full sentences, then through every symbol programmers use. Pass a lesson with 90% accuracy and the speed shown to unlock the next one.`)),
      h("div", { class: "course-top" },
        h("p", null, h("strong", null, `${done} of ${LS.LESSONS.length} lessons passed.`)),
        next ? h("a", { class: "btn primary", href: "#/course/" + next.id }, done ? `Continue with lesson ${next.id}` : "Start lesson 1") : h("span", { class: "muted" }, "You have passed every lesson.")),
      h("div", { class: "lessons" }, ...cards));
    return () => {};
  }

  function lessonPage(main, id) {
    const st = TL.store.load();
    const s = st.settings;
    const lesson = LS.LESSONS.find((l) => l.id === id);
    if (!lesson) {
      main.append(h("div", { class: "page-head" }, h("h1", null, "Lesson not found"), h("p", null, h("a", { href: "#/course" }, "Back to the course"))));
      return () => {};
    }
    if (!isOpen(st, lesson)) {
      main.append(h("div", { class: "page-head" },
        h("h1", null, `Lesson ${lesson.id} is locked`),
        h("p", { class: "lead" }, `Pass lesson ${lesson.id - 1} first, or turn on "Unlock all lessons" in Settings.`),
        h("p", null, h("a", { class: "btn primary", href: "#/course/" + (lesson.id - 1) }, `Go to lesson ${lesson.id - 1}`))));
      return () => {};
    }

    const host = h("div");
    const taught = new Set(LS.introduced(lesson.id) + " ");
    const active = lesson.capitals || lesson.sentences || lesson.code ? null : taught;

    const start = () => screen.load(
      LS.lessonText(lesson, { words: S.words(), sentences: S.sentences(), code: TL.data.code.all, rng: S.rng() }), { active });

    function onFinish(session) {
      const summary = session.summary();
      S.learn(session);
      const grade = LS.grade(lesson, summary);
      const rec = record(st, lesson.id);
      st.course[lesson.id] = {
        stars: Math.max(rec.stars, grade.stars),
        wpm: Math.max(rec.wpm, summary.netWpm),
        acc: Math.max(rec.acc, summary.accuracy),
        tries: rec.tries + 1,
      };
      TL.store.recordSession({ kind: "course", label: `Lesson ${lesson.id}`, bestKey: "lesson:" + lesson.id, summary });

      const last = lesson.id === LS.LESSONS.length;
      const extras = [
        grade.passed
          ? S.banner("good", "Lesson passed.", last ? "You have finished the course." : `Lesson ${lesson.id + 1} is now open.`)
          : S.banner("bad", "Not passed yet.", `You need ${lesson.minWpm} WPM at 90% accuracy or better. You typed ${Math.round(summary.netWpm)} WPM at ${Math.round(summary.accuracy)}%.`),
        S.card("Stars this time", S.stars(grade.stars),
          h("p", { class: "muted" }, "1 star: pass. 2 stars: 95% accuracy. 3 stars: 98% accuracy and 30% over the required speed.")),
      ];
      const actions = grade.passed && !last
        ? [{ label: `Lesson ${lesson.id + 1}`, primary: true, onClick: () => { location.hash = "#/course/" + (lesson.id + 1); } }, { label: "Try again", onClick: start }, { label: "All lessons", onClick: () => { location.hash = "#/course"; } }]
        : [{ label: "Try again", primary: !grade.passed, onClick: start }, { label: "All lessons", primary: grade.passed, onClick: () => { location.hash = "#/course"; } }];

      const node = TL.ui.results.render({ title: grade.passed ? "Lesson passed" : "Keep practising", subtitle: `Lesson ${lesson.id}: ${lesson.title}`, summary, extras, actions });
      screen.showResults(node, `${grade.passed ? "Lesson passed" : "Lesson not passed"}. ${Math.round(summary.netWpm)} words per minute, ${Math.round(summary.accuracy)} percent accuracy.`);
    }

    const screen = TL.ui.typing.create(host, { settings: s, onFinish, onNew: start });
    const rec = record(st, lesson.id);
    main.append(
      h("p", null, h("a", { href: "#/course" }, "← All lessons")),
      h("div", { class: "page-head" },
        h("h1", null, `Lesson ${lesson.id}: ${lesson.title}`),
        h("p", { class: "lead" }, lesson.tip),
        h("p", { class: "muted" }, `To pass: ${lesson.minWpm} WPM with at least 90% accuracy. `, rec.tries ? ["Your best: ", S.stars(rec.stars), ` ${Math.round(rec.wpm)} WPM.`] : "")),
      host);
    start();
    return () => screen.destroy();
  }

  function mount(main, params) {
    return params[0] ? lessonPage(main, parseInt(params[0], 10)) : map(main);
  }

  TL.pages = TL.pages || {};
  TL.pages.course = { title: "Course", mount };
})(window);
