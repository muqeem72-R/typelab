/* TypeLab page: the course, laid out like TypingMaster's.
     #/course                     the list of courses (description, length, lessons, how much is studied, Start Now / Continue Course)
     #/course/<lesson>            one lesson: its numbered exercises with a mark for each, and the lesson buttons
     #/course/<lesson>/<n>        one exercise (a key drill, a word drill, a text drill, or the lesson exam)
   A lesson is passed with its exam (as before), which opens the next lesson. Exercises can be done in any order. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h, fmt, tile } = TL.ui;
  const S = TL.shared;
  const LS = TL.lessons;

  const MINUTES_PER_EXERCISE = 2.5;

  const record = (st, id) => st.course[id] || { stars: 0, wpm: 0, acc: 0, tries: 0 };
  const isOpen = (st, lesson) =>
    lesson.id === 1 || st.settings.unlockAllLessons || record(st, lesson.id - 1).stars > 0;

  // The exercises of a lesson that are done. A lesson passed before exercises existed counts as all done.
  function doneSet(st, lesson) {
    const rec = record(st, lesson.id);
    const list = LS.exercises(lesson);
    const done = new Set(rec.ex || []);
    if (rec.stars > 0) {
      if (!rec.ex) list.forEach((e) => done.add(e.n));
      else done.add(list.length);   // the exam is the last exercise
    }
    return done;
  }
  const nextExercise = (st, lesson) => {
    const done = doneSet(st, lesson);
    return LS.exercises(lesson).find((e) => !done.has(e.n)) || null;
  };

  function courseStats(st, course) {
    const lessons = LS.lessonsOf(course);
    let done = 0;
    let total = 0;
    let passed = 0;
    for (const l of lessons) {
      total += LS.exercises(l).length;
      done += doneSet(st, l).size;
      if (record(st, l.id).stars > 0) passed++;
    }
    return { lessons, done, total, passed, percent: total ? Math.round((done / total) * 100) : 0, open: isOpen(st, lessons[0]) };
  }

  // The lesson to go to when the course is continued: the first open lesson that is not passed yet.
  function resumeLesson(st, course) {
    const lessons = LS.lessonsOf(course);
    return lessons.find((l) => record(st, l.id).stars === 0 && isOpen(st, l)) || lessons[lessons.length - 1];
  }

  function length(minutes) {
    if (minutes < 90) return "about " + Math.round(minutes / 5) * 5 + " minutes";
    const hours = Math.round((minutes / 60) * 2) / 2;
    return "about " + (Number.isInteger(hours) ? hours : hours.toFixed(1)) + " hours";
  }

  function keysLabel(lesson) {
    if (lesson.capitals) return "Shift";
    if (lesson.sentences) return "All keys";
    if (lesson.code) return "Code lines";
    if (!lesson.keys) return "camelCase, snake_case";
    return [...lesson.keys].map((k) => h("kbd", null, k)).flatMap((k, i) => (i ? [" ", k] : [k]));
  }

  const mark = (state) => h("span", { class: "ex-mark " + state, "aria-hidden": "true" }, state === "done" ? "✓" : state === "next" ? "▶" : state === "locked" ? "–" : "");
  const stateText = { done: "done", next: "next", todo: "not done yet", locked: "locked" };

  // ---- 1. the list of courses -------------------------------------------------------------------------------------

  function coursesPage(main) {
    const st = TL.store.load();
    const all = LS.LESSONS;
    const passedAll = all.filter((l) => record(st, l.id).stars > 0).length;

    const cards = LS.COURSES.map((course, index) => {
      const info = courseStats(st, course);
      const started = info.done > 0;
      const finished = info.passed === info.lessons.length;
      const resume = resumeLesson(st, course);
      const need = course.after ? all.find((l) => l.id === course.after) : null;
      const locked = !info.open;
      const minutes = info.total * MINUTES_PER_EXERCISE;
      const fill = h("span", { class: "meter-fill" });
      fill.style.width = info.percent + "%";

      const dots = h("ul", { class: "lesson-dots", "aria-label": "Lessons of this course" },
        ...info.lessons.map((l) => h("li", { class: record(st, l.id).stars > 0 ? "passed" : isOpen(st, l) ? "open" : "", title: `Lesson ${l.id}: ${l.title}` }, h("span", { class: "sr-only" }, `Lesson ${l.id}, ${record(st, l.id).stars > 0 ? "passed" : isOpen(st, l) ? "open" : "locked"}`))));

      const action = locked
        ? h("div", { class: "course-lock" }, h("span", { class: "btn", "aria-disabled": "true" }, "Locked"), h("p", { class: "muted" }, `Pass lesson ${need ? need.id : course.first - 1} of the Touch Typing course to open this one.`))
        : h("a", { class: "btn primary big", href: "#/course/" + resume.id }, finished ? "Review Course" : started ? "Continue Course" : "Start Now");

      return h("section", { class: "course-card" + (locked ? " locked" : ""), "data-course": course.id },
        h("div", { class: "course-no", "aria-hidden": "true" }, String(index + 1)),
        h("div", { class: "course-body" },
          h("div", { class: "course-title" }, h("h2", null, course.title),
            h("span", { class: "chip-state " + (finished ? "done" : started ? "going" : "") }, finished ? "Completed" : started ? "In progress" : locked ? "Locked" : "Not started")),
          h("p", { class: "course-blurb" }, course.blurb),
          h("ul", { class: "course-facts" },
            h("li", null, h("strong", null, String(info.lessons.length)), " lessons"),
            h("li", null, h("strong", null, String(info.total)), " exercises"),
            h("li", null, "Takes ", h("strong", null, length(minutes))),
            h("li", null, h("strong", null, info.percent + "%"), " studied")),
          h("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(info.percent), "aria-label": course.title + " studied" }, fill),
          dots),
        h("div", { class: "course-act" }, action));
    });

    const tiers = TL.certificate.status(st.course, TL.rank.lessonRun);
    const aside = h("aside", { class: "course-aside", "aria-label": "Your course progress" },
      h("section", { class: "card" },
        h("h2", { class: "sub" }, "Your progress"),
        h("p", { class: "big-n" }, h("strong", null, String(passedAll)), ` of ${all.length} lessons passed`),
        h("p", { class: "muted" }, "A lesson is passed with its exam: 90% accuracy at the speed shown for that lesson. The exam is the last exercise of every lesson.")),
      h("section", { class: "card" },
        h("h2", { class: "sub" }, "Certificates"),
        h("ul", { class: "list" }, ...tiers.map((t) => h("li", null, h("strong", null, t.title), `: ${t.passed} of ${t.lessons} lessons`, t.done ? " ✓" : ""))),
        h("a", { class: "btn", href: "#/stats" }, "See my certificates")),
      h("section", { class: "card" },
        h("h2", { class: "sub" }, "Prefer to just type?"),
        h("p", { class: "muted" }, "Practice never stops and adapts to your weakest keys."),
        h("a", { class: "btn", href: "#/practice" }, "Go to Practice")));

    main.append(
      h("div", { class: "page-head" },
        h("h1", null, "Courses"),
        h("p", { class: "lead" }, "Pick a course and carry on where you stopped. Each course has lessons, and each lesson has short numbered exercises that end with an exam.")),
      h("div", { class: "grid narrow-wide course-grid" }, h("div", { class: "course-list" }, ...cards), aside));
    return () => {};
  }

  // ---- 2. one lesson ----------------------------------------------------------------------------------------------

  function notFound(main, text, hash) {
    main.append(h("div", { class: "page-head" }, h("h1", null, text), h("p", null, h("a", { class: "btn primary", href: hash || "#/course" }, "Back to the courses"))));
    return () => {};
  }

  function lessonPage(main, id) {
    const st = TL.store.load();
    const lesson = LS.LESSONS.find((l) => l.id === id);
    if (!lesson) return notFound(main, "Lesson not found");
    const course = LS.courseOf(lesson.id);
    const lessons = LS.lessonsOf(course);
    const pos = lessons.indexOf(lesson) + 1;

    if (!isOpen(st, lesson)) {
      main.append(h("div", { class: "page-head" },
        h("h1", null, `Lesson ${lesson.id} is locked`),
        h("p", { class: "lead" }, `Pass lesson ${lesson.id - 1} first, or turn on "Unlock all course lessons" in Settings.`),
        h("p", null, h("a", { class: "btn primary", href: "#/course/" + (lesson.id - 1) }, `Go to lesson ${lesson.id - 1}`), " ", h("a", { class: "btn", href: "#/course" }, "All courses"))));
      return () => {};
    }

    const rec = record(st, lesson.id);
    const done = doneSet(st, lesson);
    const list = LS.exercises(lesson);
    const next = nextExercise(st, lesson);
    const prev = lessons[pos - 2];
    const following = lessons[pos];
    const followingOpen = following && isOpen(st, following);
    const nextLesson = lessons.find((l) => record(st, l.id).stars === 0 && isOpen(st, l));

    const rail = h("nav", { class: "lesson-rail card", "aria-label": course.title + " lessons" },
      h("h2", { class: "sub" }, "Lessons"),
      h("ol", null, ...lessons.map((l) => {
        const open = isOpen(st, l);
        const passed = record(st, l.id).stars > 0;
        const body = [mark(passed ? "done" : open ? (l === lesson ? "next" : "todo") : "locked"), h("span", { class: "rail-n" }, String(l.id)), h("span", { class: "rail-t" }, l.title), h("span", { class: "sr-only" }, passed ? "passed" : open ? "open" : "locked")];
        return h("li", { class: l === lesson ? "current" : "" },
          open ? h("a", { href: "#/course/" + l.id, "aria-current": l === lesson ? "page" : null }, ...body) : h("span", { class: "rail-locked", "aria-disabled": "true" }, ...body));
      })));

    const rows = list.map((e) => {
      const isDone = done.has(e.n);
      const state = isDone ? "done" : next && next.n === e.n ? "next" : "todo";
      return h("li", { class: "ex-row " + state },
        h("a", { class: "ex-link", href: `#/course/${lesson.id}/${e.n}` },
          mark(state),
          h("span", { class: "ex-num" }, `${lesson.id}.${e.n}`),
          h("span", { class: "ex-text" }, h("strong", null, e.title), h("span", { class: "muted" }, e.hint)),
          h("span", { class: "ex-type " + e.type }, e.label),
          h("span", { class: "ex-go" }, isDone ? "Repeat" : "Begin"),
          h("span", { class: "sr-only" }, stateText[state])));
    });

    const panel = h("section", { class: "lesson-panel card" },
      h("div", { class: "lesson-head" },
        h("p", { class: "crumbs" }, h("a", { href: "#/course" }, "Courses"), " › ", course.title, " › ", `Lesson ${pos} of ${lessons.length}`, " ", h("a", { class: "change", href: "#/course" }, "Change course")),
        h("h1", null, `Lesson ${lesson.id}: ${lesson.title}`),
        h("p", { class: "lesson-keys" }, "Keys: ", ...[].concat(keysLabel(lesson))),
        h("p", { class: "lead" }, lesson.tip),
        h("p", { class: "muted" }, `To pass the lesson exam: ${lesson.minWpm} WPM with at least 90% accuracy. `, rec.tries ? ["Your best: ", S.stars(rec.stars), ` ${Math.round(rec.wpm)} WPM.`] : "")),
      h("ol", { class: "exercise-list", "aria-label": `Exercises of lesson ${lesson.id}` }, ...rows),
      h("div", { class: "lesson-nav" },
        prev ? h("a", { class: "btn", href: "#/course/" + prev.id }, "◀ Lesson " + prev.id) : h("span"),
        next ? h("a", { class: "btn primary big", href: `#/course/${lesson.id}/${next.n}` }, `Begin exercise ${lesson.id}.${next.n}`) : h("span", { class: "muted" }, "Every exercise is done."),
        h("span", { class: "lesson-nav-end" },
          following ? (followingOpen ? h("a", { class: "btn", href: "#/course/" + following.id }, "Lesson " + following.id + " ▶") : h("span", { class: "btn", "aria-disabled": "true", title: "Pass this lesson's exam to open it" }, "Lesson " + following.id + " ▶")) : null,
          nextLesson && nextLesson !== lesson ? h("a", { class: "btn", href: "#/course/" + nextLesson.id, title: "The lesson you are up to" }, "»") : null)));

    main.append(h("div", { class: "lesson-layout" }, rail, panel));
    return () => {};
  }

  // ---- 3. one exercise -------------------------------------------------------------------------------------------

  function exercisePage(main, id, n) {
    const st = TL.store.load();
    const s = st.settings;
    const lesson = LS.LESSONS.find((l) => l.id === id);
    if (!lesson) return notFound(main, "Lesson not found");
    const list = LS.exercises(lesson);
    const ex = list[n - 1];
    if (!ex) return notFound(main, "Exercise not found", "#/course/" + lesson.id);
    if (!isOpen(st, lesson)) { location.replace("#/course/" + lesson.id); return () => {}; }
    const course = LS.courseOf(lesson.id);
    const isExam = ex.type === "exam";

    const host = h("div");
    const taught = new Set(LS.introduced(lesson.id) + " ");
    const active = lesson.capitals || lesson.sentences || lesson.code ? null : taught;

    const start = () => {
      screen.load(LS.exerciseText(lesson, n, { words: S.words(), sentences: S.sentences(), code: TL.data.code.all, rng: S.rng() }), { active });
      screen.keyboard.hidden = ex.type === "text" || !s.showKeyboard;   // a text drill has no keyboard picture
      main.classList.toggle("text-drill", ex.type === "text");          // and shows many lines at once
    };
    const go = (hash) => () => { location.hash = hash; };

    function onFinish(session) {
      const summary = session.summary();
      S.learn(session);
      const rec = record(st, lesson.id);
      const done = new Set(rec.ex || (rec.stars > 0 ? list.map((e) => e.n) : []));
      let grade = null;
      if (isExam) {
        grade = LS.grade(lesson, summary);
        if (grade.passed) done.add(n);
      } else done.add(n);
      st.course[lesson.id] = {
        stars: isExam ? Math.max(rec.stars, grade.stars) : rec.stars,
        wpm: isExam ? Math.max(rec.wpm, summary.netWpm) : rec.wpm,
        acc: isExam ? Math.max(rec.acc, summary.accuracy) : rec.acc,
        tries: rec.tries + (isExam ? 1 : 0),
        ex: [...done].sort((a, b) => a - b),
      };
      TL.store.recordSession({ kind: "course", label: `Exercise ${lesson.id}.${n}`, bestKey: isExam ? "lesson:" + lesson.id : null, summary });
      goalBox.update(0, "ready");

      const evalNote = LS.evaluate(summary, lesson.minWpm);
      const extras = [S.banner(evalNote.kind, evalNote.label + ".", evalNote.text)];
      const actions = [];
      const lastOfCourse = lesson.id === course.last;
      const lastLesson = lesson.id === LS.LESSONS.length;
      if (isExam) {
        extras.push(grade.passed
          ? S.banner("good", "Lesson passed.", lastLesson ? "You have finished the whole course." : lastOfCourse && LS.courseOf(lesson.id + 1) ? `The ${LS.courseOf(lesson.id + 1).title} course is now open.` : `Lesson ${lesson.id + 1} is now open.`)
          : S.banner("bad", "Not passed yet.", `You need ${lesson.minWpm} WPM at 90% accuracy or better. You typed ${Math.round(summary.netWpm)} WPM at ${Math.round(summary.accuracy)}%.`),
        S.card("Stars this time", S.stars(grade.stars),
          h("p", { class: "muted" }, "1 star: pass. 2 stars: 95% accuracy. 3 stars: 98% accuracy and 30% over the required speed.")));
        if (grade.passed && !lastLesson) actions.push({ label: `Lesson ${lesson.id + 1}`, primary: true, onClick: go("#/course/" + (lesson.id + 1)) });
        actions.push({ label: "Try again", primary: !grade.passed, onClick: start }, { label: "Lesson " + lesson.id, onClick: go("#/course/" + lesson.id) });
        if (grade.passed && lastLesson) actions.push({ label: "All courses", primary: true, onClick: go("#/course") });
      } else {
        actions.push({ label: `Exercise ${lesson.id}.${n + 1}`, primary: true, onClick: go(`#/course/${lesson.id}/${n + 1}`) },
          { label: "Repeat", onClick: start }, { label: "Lesson " + lesson.id, onClick: go("#/course/" + lesson.id) });
      }
      const title = isExam ? (grade.passed ? "Lesson passed" : "Keep practising") : `Exercise ${lesson.id}.${n} complete`;
      const node = TL.ui.results.render({
        title, subtitle: `${ex.label}: ${ex.title}`, summary, extras, actions,
        tiles: [
          tile("Duration", fmt.clock(summary.ms)),
          tile("Gross speed", Math.round(summary.rawWpm) + " WPM", "everything typed"),
          tile("Accuracy", fmt.num(summary.accuracy, 1) + "%"),
          tile("Net speed", Math.round(summary.netWpm) + " WPM", "correct keys only"),
          tile("Mistakes", String(summary.errors)),
        ],
      });
      screen.showResults(node, `${title}. ${Math.round(summary.netWpm)} words per minute, ${Math.round(summary.accuracy)} percent accuracy.`);
    }

    const screen = TL.ui.typing.create(host, {
      settings: s, onFinish, onNew: null,
      toolbarExtra: [h("a", { class: "btn", href: "#/course/" + lesson.id }, "Lesson " + lesson.id)],
    });

    // The same one-screen desktop layout as Practice: the exercise in the middle, a column on each side.
    main.classList.add("page-practice");
    document.body.classList.add("fit-screen");
    const goalBox = S.goal();
    const done = doneSet(st, lesson);
    const next = nextExercise(st, lesson);
    const mini = h("ol", { class: "ex-mini" }, ...list.map((e) => {
      const state = done.has(e.n) ? "done" : next && next.n === e.n ? "next" : "todo";
      return h("li", { class: (e.n === n ? "current " : "") + state },
        h("a", { href: `#/course/${lesson.id}/${e.n}`, "aria-current": e.n === n ? "page" : null }, mark(state), h("span", { class: "ex-num" }, `${lesson.id}.${e.n}`), h("span", null, e.title)));
    }));
    main.append(
      h("div", { class: "pp-grid" },
        h("aside", { class: "pp-side pp-left", "aria-label": "This lesson" },
          h("div", { class: "pp-head" },
            h("p", { class: "crumbs" }, h("a", { href: "#/course" }, course.title), " › ", h("a", { href: "#/course/" + lesson.id }, `Lesson ${lesson.id}`)),
            h("h1", null, `Exercise ${lesson.id}.${n}`),
            h("p", { class: "lead" }, ex.title)),
          h("section", { class: "pp-card" }, h("h2", { class: "sub" }, lesson.title), mini)),
        h("div", { class: "pp-main" }, host),
        h("aside", { class: "pp-side pp-right", "aria-label": "Streak and tips" },
          goalBox,
          h("section", { class: "pp-card" },
            h("h2", { class: "sub" }, ex.label),
            h("p", { class: "muted" }, ex.hint),
            isExam ? h("p", { class: "muted" }, `Pass mark: ${lesson.minWpm} WPM at 90% accuracy.`) : null),
          h("section", { class: "pp-card" }, h("h2", { class: "sub" }, "Tip"), h("p", { class: "muted" }, lesson.tip)))));

    // The streak timer runs while this exercise does, like in Practice.
    let toasted = false;
    const live = () => { const x = screen.session; return x && x.started && !x.finished ? x.liveActiveMs(performance.now()) : 0; };
    const timer = setInterval(() => {
      const x = screen.session;
      const now = performance.now();
      const extra = live();
      const running = !!(x && x.started && !x.finished);
      goalBox.update(extra, !running ? "ready" : x.pausedAt == null && now - x.lastPressAt < 2000 ? "typing" : "paused");
      const base = TL.store.todayActiveMs();
      if (extra && !toasted && base < TL.store.STREAK_MS && base + extra >= TL.store.STREAK_MS) {
        toasted = true;
        screen.toast("Streak day complete! 5 minutes typed", "good");
      }
    }, 250);
    TL.liveTyping = live;

    start();
    return () => {
      clearInterval(timer);
      TL.liveTyping = null;
      main.classList.remove("page-practice", "text-drill");
      document.body.classList.remove("fit-screen");
      screen.destroy();
    };
  }

  function mount(main, params) {
    const lessonId = parseInt(params[0], 10);
    if (!params[0]) return coursesPage(main);
    if (params[1]) return exercisePage(main, lessonId, parseInt(params[1], 10));
    return lessonPage(main, lessonId);
  }

  TL.pages = TL.pages || {};
  TL.pages.course = { title: "Course", mount };
})(window);
