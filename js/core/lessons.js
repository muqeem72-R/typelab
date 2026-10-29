/* TypeLab course: a fixed path from the home row to full sentences, then a programmer track
   with every remaining symbol and real code lines.
   Each lesson introduces a few keys, builds its text from drills of those keys plus
   real words that use them, and is passed with enough accuracy and speed. */
(function (root) {
  "use strict";

  const TG = typeof require === "function" ? require("./textgen.js") : root.TL.textgen;

  const LESSONS = [
    { id: 1, title: "Home row: left hand", keys: "asdf", minWpm: 8,
      tip: "Rest your left fingers on A, S, D and F. Little finger on A, index finger on F. Keep your eyes on the screen." },
    { id: 2, title: "Home row: right hand", keys: "jkl;", minWpm: 8,
      tip: "Right index finger on J, little finger on the semicolon. Your thumbs rest on the space bar." },
    { id: 3, title: "Reaching G and H", keys: "gh", minWpm: 10,
      tip: "Your index fingers reach one key inward to G and H, then return to F and J." },
    { id: 4, title: "Top row: E and I", keys: "ei", minWpm: 10,
      tip: "E is typed by the left middle finger and I by the right middle finger. Reach up, then come straight back home." },
    { id: 5, title: "Top row: R and U", keys: "ru", minWpm: 12,
      tip: "R and U belong to the index fingers. They sit directly above F and J." },
    { id: 6, title: "Top row: T and Y", keys: "ty", minWpm: 12,
      tip: "T and Y are the long index-finger reaches, one key towards the middle of the keyboard." },
    { id: 7, title: "Top row: W and O", keys: "wo", minWpm: 14,
      tip: "W is the left ring finger and O is the right ring finger. Ring fingers are weaker, so go slowly." },
    { id: 8, title: "Top row: Q and P", keys: "qp", minWpm: 14,
      tip: "Both little fingers stretch up to Q and P. Keep your wrists still and move only the finger." },
    { id: 9, title: "Bottom row: V, M and comma", keys: "vm,", minWpm: 15,
      tip: "Index fingers curl down to V and M. The right middle finger types the comma." },
    { id: 10, title: "Bottom row: C and period", keys: "c.", minWpm: 15,
      tip: "C is the left middle finger and the period is the right ring finger." },
    { id: 11, title: "Bottom row: X, Z and slash", keys: "xz/", minWpm: 15,
      tip: "X is the left ring finger, Z the left little finger and slash the right little finger." },
    { id: 12, title: "Bottom row: B and N", keys: "bn", minWpm: 16,
      tip: "B and N are the last letters. Index fingers stretch towards the middle of the bottom row." },
    { id: 13, title: "Capital letters", keys: "", capitals: true, minWpm: 16,
      tip: "Hold Shift with the little finger of the hand that is NOT typing the letter. The highlighted Shift key on screen shows which one." },
    { id: 14, title: "Numbers 1 to 5", keys: "12345", minWpm: 16,
      tip: "Reach from the home row to the number row with the same finger that owns that column, then return." },
    { id: 15, title: "Numbers 6 to 0", keys: "67890", minWpm: 16,
      tip: "Right hand numbers: 6 and 7 with the index finger, 8 middle, 9 ring and 0 little finger." },
    { id: 16, title: "Punctuation: apostrophe, hyphen, ? ! :", keys: "'-?!:", minWpm: 18,
      tokens: ["don't", "it's", "can't", "won't", "I'm", "we're", "that's", "well-known", "long-term", "so-called",
        "what?", "why?", "how?", "who?", "stop!", "go!", "wow!", "note:", "yes:", "next:"],
      tip: "Most punctuation is typed with the right little finger. Use the left Shift for ? ! and :." },
    { id: 17, title: "Quotes and brackets", keys: "\"()", minWpm: 18,
      tokens: ["\"hello\"", "\"quick\"", "\"fine\"", "\"time\"", "(yes)", "(no)", "(and)", "(done)", "(maybe)", "(later)"],
      tip: "Quotes use Shift with the right little finger. Brackets are Shift plus 9 and 0, typed by the ring and little fingers." },
    { id: 18, title: "Real sentences", keys: "", sentences: true, minWpm: 20,
      tip: "Now everything together. Type steadily, keep a calm rhythm and let accuracy lead." },

    // The programmer track: every symbol that is left on the keyboard, then real code.
    { id: 19, title: "Symbols above the numbers", keys: "@#$%^&*", minWpm: 12, tokenShare: 0.75, coder: true,
      tokens: ["@home", "#1", "$50", "100%", "x^2", "a&b", "*ptr", "me@mail", "#tag", "$HOME", "50%", "&&", "**", "@@",
        "$$", "#5", "a*b", "2^8", "@user", "$9", "R&D", "#id", "5%", "&x", "%d"],
      tip: "These are Shift plus a number: @ is Shift 2, # is Shift 3, $ is Shift 4, % is Shift 5, ^ is Shift 6, & is Shift 7 and * is Shift 8. Use the Shift key on the other hand." },
    { id: 20, title: "Square and curly brackets", keys: "[]{}", minWpm: 12, tokenShare: 0.75, coder: true,
      tokens: ["[0]", "[i]", "arr[2]", "{}", "{x}", "[]", "{a}", "[1,2]", "{id}", "a[i]", "([])", "{[]}", "list[0]", "{x:1}",
        "[a,b]", "map[k]", "{}[]", "[[0]]", "{name}"],
      tip: "The right little finger types all four, next to the P key. Curly braces need Shift." },
    { id: 21, title: "Maths and comparisons", keys: "+=<>_", minWpm: 12, tokenShare: 0.75, coder: true,
      tokens: ["a+b", "x==y", "i<n", "x>=0", "a<=b", "x+=1", "a=b", "my_var", "i++", "a-b", "x*2", "a/b", "x!=y",
        "snake_case", "n<=9", "<a>", "a+=1", "x=>x", "max_len", "a<b>c"],
      tip: "+ and = share a key (Shift for +), and so do - and _ (Shift for _). < and > are Shift plus comma and period." },
    { id: 22, title: "Backslash, pipe, tilde and backtick", keys: "\\|~`", minWpm: 12, tokenShare: 0.75, coder: true,
      tokens: ["a|b", "a||b", "~x", "`a`", "C:\\dir", "\\n", "/usr/bin", "a\\b", "x|y", "~/home", "\\t", "`code`",
        "a|b|c", "~5", "\\\\", "||", "|x|", "`x`"],
      tip: "Backslash and pipe share a key above Enter, and the backtick and tilde share the key left of 1. Use your right and left little finger." },
    { id: 23, title: "Names in code", keys: "", minWpm: 14, coder: true,
      tokens: ["getUserName", "isValid", "max_value", "HTTP_OK", "my-class", "__init__", "userId", "parseInt", "to_string",
        "MAX_SIZE", "toString", "onClick", "set_name", "firstName", "API_KEY", "user-id", "isEmpty", "get_all", "NODE_ENV",
        "backgroundColor"],
      tip: "camelCase, snake_case, CONSTANT_CASE and kebab-case all mix capitals, underscores and hyphens. Keep your Shift timing smooth." },
    { id: 24, title: "Real code lines", keys: "", code: true, minWpm: 14, coder: true,
      tip: "Real one-line snippets from JavaScript, Python, HTML, CSS, SQL and the shell. Spaces and symbols matter, so slow down and stay accurate." },
  ];

  const introduced = (id) => LESSONS.filter((l) => l.id <= id).map((l) => l.keys).join("");

  const GROUPS = 24;        // drills and words per lesson text
  const MIN_PER_KEY = 3;    // every new key appears at least this often

  function lessonText(lesson, { words, sentences, code, rng }) {
    if (lesson.sentences) return TG.pickSentences(sentences, 3, rng).join(" ");
    if (lesson.code) return TG.pickSentences(code, 3, rng).join(" ");

    // Only names or tokens, no new keys: just mix the tokens.
    if (lesson.tokens && !lesson.keys) {
      const out = [];
      while (out.length < 20) {
        const t = TG.pick(lesson.tokens, rng);
        if (t !== out[out.length - 1]) out.push(t);
      }
      return out.join(" ");
    }

    const known = introduced(lesson.id);
    const letters = new Set(known);
    const real = words.filter((w) => w.length >= 2 && [...w].every((c) => letters.has(c)));

    if (lesson.capitals) {
      const out = [];
      while (out.length < 20) {
        const w = TG.pick(real, rng);
        if (w !== out[out.length - 1]) out.push(rng() < 0.2 && w.length <= 4 ? w.toUpperCase() : TG.capitalize(w));
      }
      return out.join(" ");
    }

    const newKeys = [...lesson.keys];
    const isNumbers = /\d/.test(lesson.keys);
    const fresh = real.filter((w) => newKeys.some((k) => w.includes(k)));
    const drill = (len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        const fromNew = isNumbers || rng() < 0.6;
        s += TG.pick(fromNew ? newKeys : [...known.replace(/\d/g, "")], rng);
      }
      return s;
    };

    const out = [];
    while (out.length < GROUPS) {
      const r = rng();
      let g;
      if (lesson.tokens && r < (lesson.tokenShare || 0.45)) g = TG.pick(lesson.tokens, rng);
      else if (isNumbers && r < 0.4 && real.length) g = TG.pick(real, rng);
      else if (!isNumbers && fresh.length >= 6 && r < 0.65) g = TG.pick(fresh, rng);
      else if (!isNumbers && real.length >= 10 && lesson.id > 3 && r < 0.8) g = TG.pick(real, rng);
      else g = drill(2 + Math.floor(rng() * 3));
      if (g !== out[out.length - 1]) out.push(g);
    }

    // Punctuation and number keys are not in any word, so make sure every new key still
    // appears a few times, by swapping some groups for short drills that contain it.
    const count = (k) => out.join(" ").split(k).length - 1;
    for (let guard = 0; guard < 60; guard++) {
      const missing = newKeys.find((k) => count(k) < MIN_PER_KEY);
      if (!missing) break;
      const d = drill(3 + Math.floor(rng() * 2));
      const at = Math.floor(rng() * d.length);
      out[Math.floor(rng() * out.length)] = d.slice(0, at) + missing + d.slice(at + 1);
    }
    return out.join(" ");
  }


  // ---- courses, exercises and exams ---------------------------------------------------------------------------------
  // Laid out like TypingMaster's course: a list of courses; each course is a list of lessons; each lesson is a list of
  // numbered exercises (key drills, word drills, a text drill) that ends with the lesson exam. The lessons keep their
  // numbers (1 to 24), because certificates and saved progress are counted by them.

  const COURSES = [
    { id: "touch", title: "Touch Typing", first: 1, last: 18,
      blurb: "Learn every key by touch: the home row, the top and bottom rows, capital letters, numbers, punctuation and whole sentences. Start here." },
    { id: "programmer", title: "Programmer Track", first: 19, last: 24, after: 18,
      blurb: "Every symbol a programmer types: @ # $ % ^ & *, square and curly brackets, operators, backslash and pipe, names in camelCase and snake_case, and real lines of code." },
  ];
  const courseOf = (lessonId) => COURSES.find((c) => lessonId >= c.first && lessonId <= c.last) || null;
  const lessonsOf = (course) => LESSONS.filter((l) => l.id >= course.first && l.id <= course.last);

  function kindOf(lesson) {
    if (lesson.sentences) return "sentences";
    if (lesson.code) return "code";
    if (lesson.capitals) return "capitals";
    if (lesson.tokens && !lesson.keys) return "names";
    if (lesson.tokens) return "symbols";
    if (/\d/.test(lesson.keys)) return "numbers";
    return "letters";
  }

  const spaced = (keys) => [...keys].map((k) => k.toUpperCase()).join(" ");
  const EXERCISE_TYPE = { keys: "Key drill", words: "Word drill", text: "Text drill", exam: "Lesson exam" };

  // The exercises of a lesson, in order. The last one is always the lesson exam.
  function exercises(lesson) {
    const kind = kindOf(lesson);
    const keys = spaced(lesson.keys);
    const plan = {
      letters: [
        ["keys", "New keys: " + keys, "Only the new keys, until your fingers know where they are."],
        ["keys", lesson.id === 1 ? "New keys in groups" : "New and earlier keys", "The new keys mixed in short groups" + (lesson.id === 1 ? "." : " with the keys you know.")],
        ["words", "Words with the new keys", "Real words that use the new keys."],
        ["words", "Words with every key so far", "A longer run of real words from all the keys you have learned."],
        ["text", "Text drill", "A paragraph of real words. The keyboard is hidden, so find the keys by feel."],
      ],
      numbers: [
        ["keys", "New keys: " + keys, "Only the new number keys."],
        ["keys", "Number groups", "Longer groups of digits, with the digits you know."],
        ["words", "Numbers and words", "Words and numbers side by side."],
        ["text", "Text drill", "A paragraph with numbers in it. The keyboard is hidden."],
      ],
      symbols: [
        ["keys", "New keys: " + keys, "Only the new symbol keys."],
        ["keys", "New keys with letters", "The new symbols between letters you know."],
        ["words", "Symbols in short words", "Short words and codes that use the new keys."],
        ["words", "Words and symbols together", "The new codes mixed with ordinary words."],
        ["text", "Text drill", "A line of code-like text. The keyboard is hidden."],
      ],
      names: [
        ["words", "Names, first set", "camelCase, snake_case and CONSTANT_CASE names (part one)."],
        ["words", "Names, second set", "The rest of the names."],
        ["text", "Text drill", "All the names mixed. The keyboard is hidden."],
      ],
      capitals: [
        ["words", "Capital words", "Words that start with a capital letter. Use Shift with the other hand."],
        ["words", "Capitals and small words", "Capitalised words mixed with small ones."],
        ["words", "SHORT WORDS IN CAPITALS", "Short words in capitals."],
        ["text", "Text drill", "A paragraph with capitals at the start of each sentence. The keyboard is hidden."],
      ],
      sentences: [
        ["text", "Short sentences", "Short, simple sentences."],
        ["text", "Medium sentences", "A little longer."],
        ["text", "Long sentences", "Long sentences with commas and more."],
        ["text", "Text drill", "A paragraph of several sentences. The keyboard is hidden."],
      ],
      code: [
        ["words", "Short lines of code", "One-liners that are short."],
        ["words", "Medium lines of code", "A little longer."],
        ["text", "Text drill", "Several lines of code in a row. The keyboard is hidden."],
      ],
    }[kind];
    const out = plan.map(([type, title, hint], i) => ({ n: i + 1, type, label: EXERCISE_TYPE[type], title, hint }));
    out.push({ n: out.length + 1, type: "exam", label: EXERCISE_TYPE.exam, title: "Lesson exam", hint: `Type the lesson text with at least 90% accuracy at ${lesson.minWpm} WPM or more to pass the lesson.` });
    return out;
  }

  const shuffle = (list, rng) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // `count` items from a pool: every item once before any is repeated, never the same one twice in a row.
  function draw(pool, count, rng) {
    const out = [];
    let bag = [];
    while (out.length < count && pool.length) {
      if (!bag.length) { bag = shuffle(pool, rng); if (pool.length > 1 && bag[bag.length - 1] === out[out.length - 1]) bag.reverse(); }
      const next = bag.pop();
      if (next !== out[out.length - 1] || pool.length === 1) out.push(next);
    }
    return out;
  }

  // The text of one exercise. The exam is the lesson text itself.
  function exerciseText(lesson, n, { words, sentences, code, rng }) {
    const list = exercises(lesson);
    const ex = list[n - 1];
    if (!ex) return "";
    const ctx = { words, sentences, code, rng };
    if (ex.type === "exam") return lessonText(lesson, ctx);

    const kind = kindOf(lesson);
    const known = introduced(lesson.id);
    const letters = new Set(known);
    const real = words.filter((w) => w.length >= 2 && [...w].every((c) => letters.has(c)));
    const newKeys = [...lesson.keys];
    const isNumbers = kind === "numbers";
    const plain = [...known.replace(/\d/g, "")];
    const pickKey = (fromNew) => TG.pick(fromNew ? newKeys : (plain.length ? plain : newKeys), rng);
    const group = (len, newShare) => { let s = ""; for (let i = 0; i < len; i++) s += pickKey(rng() < newShare); return s; };
    const ensureKeys = (out, minimum = MIN_PER_KEY) => {
      for (let guard = 0; guard < 80 && newKeys.length; guard++) {
        const text = out.join(" ");
        const missing = newKeys.find((k) => text.split(k).length - 1 < minimum);
        if (!missing) break;
        const d = group(3, 1);
        const at = Math.floor(rng() * d.length);
        out[Math.floor(rng() * out.length)] = d.slice(0, at) + missing + d.slice(at + 1);
      }
      return out;
    };
    const fresh = real.filter((w) => newKeys.some((k) => w.includes(k)));
    const digits = (len) => { let s = ""; for (let i = 0; i < len; i++) s += TG.pick(newKeys.length ? newKeys : [..."0123456789"], rng); return s; };

    // ---- key drills ----
    if (ex.type === "keys") {
      const out = [];
      if (isNumbers) {
        const len = n === 1 ? [2, 4] : [4, 6];
        while (out.length < 22) out.push(digits(len[0] + Math.floor(rng() * (len[1] - len[0] + 1))));
        return ensureKeys(out).join(" ");
      }
      const share = n === 1 ? 1 : 0.6;
      const minLen = n === 1 ? 2 : lesson.id === 1 ? 3 : 2;
      while (out.length < 24) {
        const g = group(minLen + Math.floor(rng() * 3), share);
        if (g !== out[out.length - 1]) out.push(g);
      }
      return ensureKeys(out).join(" ");
    }

    // ---- sentences and code ----
    if (kind === "sentences") {
      const ok = n === 1 ? (s) => s.length <= 57 : n === 2 ? (s) => s.length > 57 && s.length <= 66 : n === 3 ? (s) => s.length > 66 : () => true;
      const pool = sentences.filter(ok);
      return TG.pickSentences(pool.length >= 3 ? pool : sentences, ex.type === "text" && n === list.length - 1 ? 4 : n === 1 ? 5 : 3, rng).join(" ");
    }
    if (kind === "code") {
      const ok = n === 1 ? (s) => s.length <= 41 : n === 2 ? (s) => s.length > 41 && s.length <= 55 : () => true;
      const pool = code.filter(ok);
      return TG.pickSentences(pool.length >= 3 ? pool : code, ex.type === "text" ? 5 : 6, rng).join(" ");
    }

    // ---- names (lesson 23): the two halves of the list, then all of it ----
    if (kind === "names") {
      const half = Math.ceil(lesson.tokens.length / 2);
      const pool = n === 1 ? lesson.tokens.slice(0, half) : n === 2 ? lesson.tokens.slice(half) : lesson.tokens;
      return draw(pool, ex.type === "text" ? 26 : 20, rng).join(" ");
    }

    // ---- capitals (lesson 13) ----
    if (kind === "capitals") {
      const pool = real.filter((w) => w.length >= 3);
      if (n === 3) return draw(pool.filter((w) => w.length <= 4).length >= 6 ? pool.filter((w) => w.length <= 4) : pool, 22, rng).map((w) => w.toUpperCase()).join(" ");
      if (n === 1) return draw(pool, 22, rng).map((w) => TG.capitalize(w)).join(" ");
      if (n === 2) return draw(pool, 24, rng).map((w) => (rng() < 0.55 ? TG.capitalize(w) : w)).join(" ");
      // a paragraph: short sentences, each starting with a capital
      const text = [];
      for (let s = 0; s < 5; s++) {
        const sentence = draw(pool, 4 + Math.floor(rng() * 4), rng);
        sentence[0] = TG.capitalize(sentence[0]);
        text.push(sentence.join(" ") + ".");
      }
      return text.join(" ");
    }

    // ---- letters, numbers and symbols: word drills and text drills ----
    const tokens = lesson.tokens || [];
    const wordPool = n === 3 && fresh.length >= 6 && !tokens.length ? fresh : real;
    const out = [];
    const count = ex.type === "text" ? 36 : 26;
    const tokenShare = tokens.length ? (n >= 4 ? 0.4 : 0.7) : 0;
    const source = wordPool.length ? wordPool : null;
    const useWord = wordPool.length >= 6 ? 1 : 0.5;   // with only a few real words, they are mixed with key groups
    for (let i = 0; i < count; i++) {
      let g;
      const r = rng();
      if (tokens.length && r < tokenShare) g = TG.pick(tokens, rng);
      else if (isNumbers && r < 0.45) g = digits(2 + Math.floor(rng() * 3));
      else if (source && rng() < useWord) g = TG.pick(source, rng);
      else g = group(2 + Math.floor(rng() * 3), 0.6);
      if (g !== out[out.length - 1]) out.push(g); else i--;
    }
    return ensureKeys(out, 2).join(" ");
  }

  // A few words about how an exercise went.
  function evaluate(summary, goalWpm) {
    const acc = summary.accuracy;
    const wpm = summary.netWpm;
    if (acc >= 97 && wpm >= goalWpm) return { kind: "good", label: "Excellent", text: "Clean and quick. You are ready for the next step." };
    if (acc >= 94) return { kind: "good", label: "Good", text: wpm >= goalWpm ? "Accurate and at a good speed." : "Very accurate. Speed will follow if you keep your rhythm steady." };
    if (acc >= 88) return { kind: "warn", label: "Fair", text: "A few too many mistakes. Slow down a little: accuracy first, speed later." };
    return { kind: "bad", label: "Keep practising", text: "Many mistakes. Look at the keyboard guide, use the finger shown and type slowly." };
  }

  // 1 star for passing, 2 for 95% accuracy, 3 for 98% accuracy and a clear speed margin.
  function grade(lesson, summary) {
    const passed = summary.accuracy >= 90 && summary.netWpm >= lesson.minWpm;
    let stars = passed ? 1 : 0;
    if (passed && summary.accuracy >= 95) stars = 2;
    if (passed && summary.accuracy >= 98 && summary.netWpm >= lesson.minWpm * 1.3) stars = 3;
    return { passed, stars };
  }

  const api = { LESSONS, COURSES, courseOf, lessonsOf, kindOf, exercises, exerciseText, evaluate, introduced, lessonText, grade };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).lessons = api;
})(typeof window !== "undefined" ? window : globalThis);
