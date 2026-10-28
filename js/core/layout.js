/* TypeLab keyboard layout: US QWERTY (ANSI), which finger presses which key, and the
   character -> key lookup the virtual keyboard and the hands overlay are driven by.
   The layout is plain data, so another layout can be added later without touching the UI. */
(function (root) {
  "use strict";

  const FINGERS = [
    { id: "lp", name: "Left pinky", hand: "left" },
    { id: "lr", name: "Left ring finger", hand: "left" },
    { id: "lm", name: "Left middle finger", hand: "left" },
    { id: "li", name: "Left index finger", hand: "left" },
    { id: "th", name: "Thumbs", hand: "both" },
    { id: "ri", name: "Right index finger", hand: "right" },
    { id: "rm", name: "Right middle finger", hand: "right" },
    { id: "rr", name: "Right ring finger", hand: "right" },
    { id: "rp", name: "Right pinky", hand: "right" },
  ];

  const BY_FINGER = {
    lp: "Backquote Digit1 KeyQ KeyA KeyZ Tab CapsLock ShiftLeft",
    lr: "Digit2 KeyW KeyS KeyX",
    lm: "Digit3 KeyE KeyD KeyC",
    li: "Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB",
    ri: "Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM",
    rm: "Digit8 KeyI KeyK Comma",
    rr: "Digit9 KeyO KeyL Period",
    rp: "Digit0 Minus Equal Backspace KeyP BracketLeft BracketRight Backslash Semicolon Quote Enter Slash ShiftRight",
    th: "Space",
  };

  const FINGER_OF = {};
  for (const id of Object.keys(BY_FINGER)) for (const code of BY_FINGER[id].split(" ")) FINGER_OF[code] = id;

  // [code, base character, shifted character, width in key units, kind]
  const letter = (c) => ["Key" + c.toUpperCase(), c, c.toUpperCase(), 1];
  const digits = [..."1234567890"].map((d, i) => ["Digit" + d, d, "!@#$%^&*()"[i], 1]);
  const mod = (code, label, w) => [code, label, null, w, "mod"];
  const pad = (w) => ["", "", null, w, "pad"];

  const SPEC = [
    [["Backquote", "`", "~", 1], ...digits, ["Minus", "-", "_", 1], ["Equal", "=", "+", 1], mod("Backspace", "Back", 2)],
    [mod("Tab", "Tab", 1.5), ..."qwertyuiop".split("").map(letter), ["BracketLeft", "[", "{", 1], ["BracketRight", "]", "}", 1], ["Backslash", "\\", "|", 1.5]],
    [mod("CapsLock", "Caps", 1.75), ..."asdfghjkl".split("").map(letter), ["Semicolon", ";", ":", 1], ["Quote", "'", "\"", 1], mod("Enter", "Enter", 2.25)],
    [mod("ShiftLeft", "Shift", 2.25), ..."zxcvbnm".split("").map(letter), ["Comma", ",", "<", 1], ["Period", ".", ">", 1], ["Slash", "/", "?", 1], mod("ShiftRight", "Shift", 2.75)],
    [pad(4.25), ["Space", " ", null, 6.5, "space"], pad(4.25)],
  ];

  const ROWS = SPEC.map((row) =>
    row.map(([code, base, shift, w, kind = "char"]) => ({
      code, base, shift, w, kind,
      finger: FINGER_OF[code] || null,
      hand: FINGER_OF[code] ? (FINGER_OF[code][0] === "l" ? "left" : FINGER_OF[code][0] === "r" ? "right" : "both") : null,
    }))
  );

  const KEY_BY_CODE = {};
  const CHAR = new Map();
  for (const row of ROWS) {
    for (const k of row) {
      if (!k.code) continue;
      KEY_BY_CODE[k.code] = k;
      if (k.kind === "char" || k.kind === "space") {
        CHAR.set(k.base, { key: k, shift: false });
        if (k.shift && k.shift !== k.base) CHAR.set(k.shift, { key: k, shift: true });
      }
    }
  }

  const HOME_CODES = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"];
  const BUMP_CODES = ["KeyF", "KeyJ"];

  const isTypable = (ch) => CHAR.has(ch);

  // Which key (and which Shift key, if any) types this character, and which fingers do the work.
  // A capital letter uses Shift on the opposite hand to the letter key.
  function describe(ch) {
    const hit = CHAR.get(ch);
    if (!hit) return null;
    const shiftKey = hit.shift ? KEY_BY_CODE[hit.key.hand === "left" ? "ShiftRight" : "ShiftLeft"] : null;
    const fingers = [hit.key.finger];
    if (shiftKey) fingers.push(shiftKey.finger);
    return { key: hit.key, shiftKey, fingers };
  }

  const api = { FINGERS, ROWS, KEY_BY_CODE, HOME_CODES, BUMP_CODES, FINGER_OF, isTypable, describe };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).layout = api;
})(typeof window !== "undefined" ? window : globalThis);
