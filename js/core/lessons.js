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

  // 1 star for passing, 2 for 95% accuracy, 3 for 98% accuracy and a clear speed margin.
  function grade(lesson, summary) {
    const passed = summary.accuracy >= 90 && summary.netWpm >= lesson.minWpm;
    let stars = passed ? 1 : 0;
    if (passed && summary.accuracy >= 95) stars = 2;
    if (passed && summary.accuracy >= 98 && summary.netWpm >= lesson.minWpm * 1.3) stars = 3;
    return { passed, stars };
  }

  const api = { LESSONS, introduced, lessonText, grade };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).lessons = api;
})(typeof window !== "undefined" ? window : globalThis);
