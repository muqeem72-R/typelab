/* TypeLab ranking: which sessions count, the ranking score, speed tiers, achievements and the
   numbers sent to the leaderboard. Pure functions, shared by the browser and the Node tests.

   The ranking score is the average of a player's best three qualifying sessions. A qualifying
   session lasted at least 20 seconds, had at least 60 correct characters and 92% accuracy, and
   used everyday text: the speed tests, or adaptive practice once 18 or more letters are in play
   (with only a few letters the text is too easy to compare). Course lessons never count. */
(function (root) {
  "use strict";

  const QUALIFY = { minMs: 20000, minChars: 60, minAcc: 92, maxWpm: 250, minLetters: 18 };
  const RANKED_MODES = ["adaptive", "time", "words", "sentences"];

  const TIERS = [
    { id: "beginner", name: "Beginner", min: 0 },
    { id: "learner", name: "Learner", min: 20 },
    { id: "typist", name: "Typist", min: 30 },
    { id: "skilled", name: "Skilled typist", min: 40 },
    { id: "fast", name: "Fast typist", min: 50 },
    { id: "expert", name: "Expert", min: 65 },
    { id: "master", name: "Master", min: 80 },
    { id: "legend", name: "Legend", min: 100 },
  ];

  const round1 = (v) => Math.round(v * 10) / 10;

  // ISO week in UTC, e.g. "2026-W44". server/core.mjs has the same function and a test keeps them equal.
  function weekId(ms) {
    const d = new Date(ms);
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  const modeOf = (s) => s.mode || (s.kind === "test" ? "time" : s.kind === "practice" ? "adaptive" : "course");

  function qualifies(s) {
    const mode = modeOf(s);
    if (!RANKED_MODES.includes(mode)) return false;
    if (mode === "adaptive" && !(s.letters >= QUALIFY.minLetters)) return false;
    return s.ms >= QUALIFY.minMs && s.chars >= QUALIFY.minChars && s.acc >= QUALIFY.minAcc && s.wpm > 0 && s.wpm <= QUALIFY.maxWpm;
  }

  const qualifying = (sessions) => sessions.filter(qualifies);

  function score(sessions) {
    const best = qualifying(sessions).map((s) => s.wpm).sort((a, b) => b - a).slice(0, 3);
    return best.length ? round1(best.reduce((a, b) => a + b, 0) / best.length) : 0;
  }

  const bestWpm = (sessions) => round1(Math.max(0, ...qualifying(sessions).map((s) => s.wpm)));

  function averageAccuracy(sessions) {
    const q = qualifying(sessions);
    return q.length ? Math.round(q.reduce((a, s) => a + s.acc, 0) / q.length) : 0;
  }

  const weeklyBest = (sessions, wk) => round1(Math.max(0, ...qualifying(sessions).filter((s) => weekId(s.ts) === wk).map((s) => s.wpm)));

  function tierFor(value) {
    let found = TIERS[0];
    for (const t of TIERS) if (value >= t.min) found = t;
    return found;
  }

  function nextTier(value) {
    const t = TIERS.find((x) => x.min > value);
    return t ? { tier: t, need: round1(t.min - value) } : null;
  }

  // Largest n such that lessons 1..n are all passed (so 18 means the core course is done and 24 means everything).
  function lessonRun(course, total = 24) {
    let n = 0;
    while (n < total && course[n + 1] && course[n + 1].stars > 0) n++;
    return n;
  }

  // What the leaderboard gets: a handful of numbers, never the sessions themselves.
  function syncStats(state, now) {
    const sessions = state.sessions;
    const wk = weekId(now);
    return {
      score: score(sessions), best: bestWpm(sessions), acc: averageAccuracy(sessions),
      sessions: sessions.length, lessons: lessonRun(state.course), wkId: wk, wk: weeklyBest(sessions, wk),
    };
  }

  const ACHIEVEMENTS = [
    { id: "first", title: "First steps", desc: "Finish your first session.", test: (c) => c.sessions.length >= 1 },
    { id: "speed30", title: "30 WPM club", desc: "Reach 30 WPM in a qualifying session.", test: (c) => c.best >= 30 },
    { id: "speed40", title: "40 WPM club", desc: "Reach 40 WPM in a qualifying session.", test: (c) => c.best >= 40 },
    { id: "speed50", title: "50 WPM club", desc: "Reach 50 WPM in a qualifying session.", test: (c) => c.best >= 50 },
    { id: "speed65", title: "65 WPM club", desc: "Reach 65 WPM in a qualifying session.", test: (c) => c.best >= 65 },
    { id: "speed80", title: "80 WPM club", desc: "Reach 80 WPM in a qualifying session.", test: (c) => c.best >= 80 },
    { id: "speed100", title: "100 WPM club", desc: "Reach 100 WPM in a qualifying session.", test: (c) => c.best >= 100 },
    { id: "sharp", title: "Sharpshooter", desc: "Type 100 characters or more in a session with 99% accuracy or better.", test: (c) => c.sessions.some((s) => s.chars >= 100 && s.acc >= 99) },
    { id: "streak3", title: "On a roll", desc: "Practise 3 days in a row.", test: (c) => c.streak >= 3 },
    { id: "streak7", title: "A full week", desc: "Practise 7 days in a row.", test: (c) => c.streak >= 7 },
    { id: "streak30", title: "Habit formed", desc: "Practise 30 days in a row.", test: (c) => c.streak >= 30 },
    { id: "marathon", title: "Marathon", desc: "Keep one practice run going for 10 minutes.", test: (c) => c.sessions.some((s) => s.ms >= 600000) },
    { id: "hours", title: "Dedicated", desc: "Practise for 5 hours in total.", test: (c) => c.sessions.reduce((a, s) => a + s.ms, 0) >= 5 * 3600000 },
    { id: "level10", title: "Level 10", desc: "Unlock 15 letters in adaptive practice.", test: (c) => c.unlocked >= 15 },
    { id: "alphabet", title: "Whole alphabet", desc: "Unlock all 26 letters.", test: (c) => c.unlocked >= 26 },
    { id: "coder", title: "Code typist", desc: "Type a code snippet at 25 WPM with 95% accuracy.", test: (c) => c.sessions.some((s) => s.mode === "code" && s.wpm >= 25 && s.acc >= 95) },
    { id: "core", title: "Touch typist", desc: "Pass lessons 1 to 18 of the course.", test: (c) => c.lessons >= 18 },
    { id: "programmer", title: "Programmer typist", desc: "Pass all 24 lessons of the course.", test: (c) => c.lessons >= 24 },
  ];

  // state is the saved profile data; streak is passed in because it depends on today's date.
  function achievements(state, streak = 0) {
    const ctx = {
      sessions: state.sessions, streak, unlocked: state.adaptive.unlocked,
      lessons: lessonRun(state.course), best: bestWpm(state.sessions),
    };
    return ACHIEVEMENTS.map((a) => ({ id: a.id, title: a.title, desc: a.desc, earned: !!a.test(ctx) }));
  }

  const api = {
    QUALIFY, RANKED_MODES, TIERS, ACHIEVEMENTS, weekId, modeOf, qualifies, qualifying, score, bestWpm, averageAccuracy,
    weeklyBest, tierFor, nextTier, lessonRun, syncStats, achievements,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).rank = api;
})(typeof window !== "undefined" ? window : globalThis);
