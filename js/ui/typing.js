/* TypeLab typing screen: the live statistics bar, the text, the toolbar and the virtual keyboard.
   Pages give it text and get a finished Session back. The only thing it saves itself is the
   sound switch in its toolbar.

   A wrong key never advances: the caret stays on the character (which pulses red) until the
   right key is typed.

   An endless run (load(text, { endless: true })) never stops by itself. The page passes
   opts.refill(session), asked after every key, which returns more text when the page wants to add
   some (or null), and opts.onKey(result, session), called after every key, which is where levels are
   checked. Level-up messages use toast(), which floats over the text and never takes focus or pauses the clock. */
(function (root) {
  "use strict";

  const { h, clear, fmt, sound } = root.TL.ui;
  const { Session } = root.TL.engine;

  const IDLE_PAUSE_MS = 8000;    // an endless run pauses its clock after this long without a key
  const TRIM_EVERY = 40;         // how often (in keys) old lines are removed from an endless run
  const KEEP_LINES_ABOVE = 2;    // lines kept above the caret's line when old lines are removed

  function create(host, opts) {
    const st = opts.settings;
    let session = null;
    let text = "";
    let cfg = {};
    let chars = [];
    let trimmed = 0;
    let timer = null;
    let toastTimer = null;
    let finished = false;
    let lineHeight = 0;
    let destroyed = false;
    let capsWarning = false;

    const hudValue = (label, hint) => {
      const value = h("span", { class: "hud-v" }, "0");
      return { value, el: h("div", { class: "hud-i", title: hint || null }, value, h("span", { class: "hud-l" }, label)) };
    };
    const hud = { wpm: hudValue("WPM"), acc: hudValue("Accuracy"), time: hudValue("Time"), err: hudValue("Mistakes") };
    const hudEl = h("div", { class: "tl-hud", role: "group", "aria-label": "Live statistics" },
      hud.wpm.el, hud.acc.el, hud.time.el, hud.err.el, ...(opts.hudExtra || []));

    const barFill = h("div", { class: "tl-bar-fill" });
    const bar = h("div", { class: "tl-bar", "aria-hidden": "true" }, barFill);
    const flow = h("div", { class: "tl-flow" });
    const hint = h("div", { class: "tl-hint" });
    const textBox = h("div", { class: "tl-text", role: "group", "aria-label": "Text to type" }, flow);
    const toastEl = h("div", { class: "tl-toast", role: "status", "aria-live": "polite" });
    const stage = h("div", { class: "tl-stage" }, textBox, toastEl);

    const restartBtn = h("button", { class: "btn", type: "button", onclick: () => restart() }, "Restart ", h("kbd", null, "Esc"));
    const newBtn = opts.onNew ? h("button", { class: "btn", type: "button", onclick: () => opts.onNew() }, "New text") : null;
    const soundBtn = h("button", { class: "btn", type: "button", onclick: () => toggleSound() });
    const toolbar = h("div", { class: "tl-tools" }, restartBtn, newBtn, soundBtn, ...(opts.toolbarExtra || []));

    function paintSoundBtn() {
      soundBtn.textContent = st.sound ? "Sound on" : "Sound off";
      soundBtn.setAttribute("aria-pressed", String(!!st.sound));
    }
    function toggleSound() {
      st.sound = !st.sound;
      root.TL.store.save();
      paintSoundBtn();
      if (st.sound) sound.play("ok", st.volume);
    }
    paintSoundBtn();

    const keyboard = root.TL.ui.keyboard.create({ showHands: st.showHands });
    keyboard.hidden = !st.showKeyboard;

    const play = h("div", { class: "tl-play" }, hudEl, bar, stage, hint, toolbar, keyboard.el);
    const slot = h("div", { class: "tl-result", hidden: true });
    const live = h("p", { class: "sr-only", role: "status" });
    const notice = root.matchMedia && root.matchMedia("(pointer: coarse)").matches
      ? h("p", { class: "notice" }, "TypeLab is made for a physical keyboard. On a phone or tablet, connect a keyboard to practise.")
      : null;
    const el = h("section", { class: "tl" }, notice, play, slot, live);
    host.append(el);

    // Adds text to the page, one word at a time. The text always joins on to what is there, so a
    // chunk that starts with a space continues the line it follows.
    function renderInto(str) {
      str.split(" ").forEach((token, ti) => {
        if (ti > 0) {
          const sp = h("span", { class: "c sp" }, " ");
          chars.push(sp);
          flow.append(sp);
        }
        if (!token) return;
        const w = h("span", { class: "w" });
        for (const ch of token) {
          const c = h("span", { class: "c" }, ch);
          chars.push(c);
          w.append(c);
        }
        flow.append(w);
      });
    }

    function render() {
      clear(flow);
      chars = [];
      trimmed = 0;
      renderInto(text);
      lineHeight = 0;
      flow.style.transform = "";
    }

    function paint(i) {
      if (i < 0 || i >= chars.length || !chars[i]) return;
      const m = session.marks[i];
      let cls = "c" + (text[i] === " " ? " sp" : "");
      if (m === 1) cls += " ok";
      else if (m === 2) cls += " fix";
      if (i === session.pos && !session.finished) cls += " cur" + (session.hadError[i] ? " err" : "");
      chars[i].className = cls;
    }

    function scroll(instant) {
      if (!chars.length) return;
      if (!lineHeight) lineHeight = parseFloat(getComputedStyle(flow).lineHeight) || 40;
      const i = Math.min(session.pos, chars.length - 1);
      if (!chars[i]) return;
      const line = Math.round(chars[i].offsetTop / lineHeight);
      if (instant) flow.style.transition = "none";
      flow.style.transform = `translateY(${-Math.max(0, line - 1) * lineHeight}px)`;
      if (instant) {
        void flow.offsetWidth;
        flow.style.transition = "";
      }
    }

    // An endless run would grow forever, so lines that are well behind the caret are taken out of the page.
    // Only whole lines go, and all at once. Text wraps from the start of each line, so removing part of a
    // line (a word but not the space after it, say) would make every line after it wrap differently and the
    // words on screen would jump sideways.
    function trim() {
      const cur = chars[session.pos];
      if (!cur) return;
      const curWord = cur.classList.contains("sp") ? cur.previousElementSibling : cur.parentNode;
      if (!curWord || !curWord.classList.contains("w")) return;
      const nodes = Array.from(flow.children);
      // The top of each line, found from its words (all the words of one line have the same top).
      const tops = [];
      for (const n of nodes) {
        if (!n.classList.contains("w")) continue;
        if (!tops.length || n.offsetTop - tops[tops.length - 1] > 3) tops.push(n.offsetTop);
        if (n === curWord) break;
      }
      const keepFrom = tops.length - 1 - KEEP_LINES_ABOVE;
      if (keepFrom < 1) return;
      const first = nodes.find((n) => n.classList.contains("w") && n.offsetTop >= tops[keepFrom] - 3);
      if (!first) return;
      const shift = first.offsetTop - nodes[0].offsetTop;
      const slide = root.DOMMatrix ? new root.DOMMatrix(getComputedStyle(flow).transform).m42 : 0;   // where the text is now, even mid-scroll
      let removed = 0;
      for (const n of nodes) {
        if (n === first) break;
        const count = n.classList.contains("w") ? n.childNodes.length : 1;
        for (let k = 0; k < count; k++) chars[trimmed + removed + k] = null;
        removed += count;
        n.remove();
      }
      trimmed += removed;
      // What is left moved up by the height of the lines taken out. Move the view down by the same amount so
      // nothing on screen changes, then carry on with the normal scroll.
      flow.style.transition = "none";
      flow.style.transform = `translateY(${slide + shift}px)`;
      void flow.offsetWidth;
      flow.style.transition = "";
      scroll();
    }

    function updateHud(now) {
      const s = session.live(now);
      if (cfg.endless) {
        hud.wpm.value.textContent = Math.round(s.rollingWpm);
        hud.acc.value.textContent = Math.round(s.rollingAccuracy) + "%";
      } else {
        hud.wpm.value.textContent = Math.round(s.wpm);
        hud.acc.value.textContent = Math.round(s.accuracy) + "%";
      }
      hud.err.value.textContent = s.errors;
      if (cfg.limitMs) {
        const left = Math.max(0, cfg.limitMs - s.ms);
        hud.time.value.textContent = fmt.clock(Math.ceil(left / 1000) * 1000);
        barFill.style.width = Math.min(100, (s.ms / cfg.limitMs) * 100) + "%";
      } else {
        hud.time.value.textContent = fmt.clock(s.ms);
        const share = cfg.endless ? (opts.barValue ? opts.barValue(session) : 0) : s.pos / s.n;
        barFill.style.width = Math.max(0, Math.min(1, share)) * 100 + "%";
      }
    }

    function showHint() {
      const paused = session.pausedAt != null;
      const idle = cfg.endless ? "Paused after a short break. Type to carry on." : "Paused. Press any key to carry on.";
      const start = cfg.endless ? "Start typing. This run never stops: new levels appear as you go." : "Start typing when you are ready";
      hint.textContent = capsWarning ? "Caps Lock is on. Turn it off to type small letters." : paused ? idle : start;
      hint.classList.toggle("warn", capsWarning);
      const started = session.started && !paused;
      textBox.classList.toggle("started", started);
      stage.classList.toggle("started", started);   // the hint is the stage's next neighbour, so it hides with it
    }

    function done() {
      if (finished) return;
      finished = true;
      stopTimer();
      for (let i = trimmed; i < chars.length; i++) paint(i);
      keyboard.target(null);
      updateHud(performance.now());
      if (st.sound) sound.play("done", st.volume);
      if (opts.onFinish) opts.onFinish(session);
    }

    function startTimer() {
      stopTimer();
      timer = setInterval(() => {
        const now = performance.now();
        session.tick(now);
        if (cfg.endless && session.pauseIfIdle(now, IDLE_PAUSE_MS)) showHint();
        updateHud(now);
        if (session.finished) done();
      }, 100);
    }
    const stopTimer = () => { clearInterval(timer); timer = null; };

    // Lets the page add more text to an endless run before the typist reaches the end.
    function topUp() {
      if (!cfg.endless || !opts.refill) return;
      const more = opts.refill(session);
      if (more) append(more);
    }

    function append(more) {
      session.append(more);
      text = session.text;
      renderInto(more);
    }

    function afterKey(before, e, ok) {
      paint(before);
      paint(session.pos);
      if (!ok && chars[session.pos]) {
        const c = chars[session.pos];
        c.classList.remove("pulse");
        void c.offsetWidth;   // restart the animation when the same key is missed again
        c.classList.add("pulse");
      }
      if (cfg.endless) topUp();
      scroll();
      if (cfg.endless && session.pos % TRIM_EVERY === 0) trim();
      keyboard.target(session.finished ? null : text[session.pos]);
      if (e && e.code) keyboard.flash(e.code, ok);
      updateHud(performance.now());
      showHint();
      if (session.finished) done();
    }

    function onKeydown(e) {
      if (destroyed || finished || !session) return;
      if (root.TL.tour && root.TL.tour.active) return;   // a guided tour is on screen: keys belong to it
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (t && t.closest && t.closest("[role=dialog]")) return;   // the theme and account pop-ups need their own keys
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (e.key === "Escape") { e.preventDefault(); restart(); return; }
      if (e.key === "Backspace") { e.preventDefault(); return; }   // nothing to take back: wrong keys never advance
      if (e.key.length !== 1) return;
      e.preventDefault();
      if (e.repeat) return;
      const now = e.timeStamp || performance.now();
      if (session.pausedAt != null) session.resume(now);
      const before = session.pos;
      const res = session.press(e.key, now);
      if (!res) {
        if (session.finished) done();
        return;
      }
      capsWarning = !res.ok && !!(e.getModifierState && e.getModifierState("CapsLock"));
      if (st.sound) sound.play(sound.forPress(res), st.volume);
      afterKey(before, e, res.ok);
      if (opts.onKey) opts.onKey(res, session);
    }

    // A held space bar would otherwise "click" a focused button when the key is released.
    function onKeyup(e) {
      if (!destroyed && !finished && e.key === " " && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault();
    }

    function onBlur() {
      if (session && session.running) {
        session.pause(performance.now());
        showHint();
      }
    }
    const onResize = () => { lineHeight = 0; if (session) scroll(true); };

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("keyup", onKeyup);
    root.addEventListener("blur", onBlur);
    root.addEventListener("resize", onResize);

    function load(newText, o = {}) {
      text = newText;
      cfg = { limitMs: o.limitMs || null, active: o.active || null, endless: !!o.endless };
      session = new Session(text, { limitMs: cfg.limitMs, endless: cfg.endless });
      finished = false;
      capsWarning = false;
      hideResults();
      render();
      toastEl.className = "tl-toast";
      keyboard.setActive(cfg.active);
      keyboard.target(text[0]);
      paint(0);
      topUp();
      updateHud(performance.now());
      showHint();
      startTimer();
    }

    function restart() {
      if (opts.onRestart) { opts.onRestart(); return; }
      if (text) load(text, cfg);
    }

    // Ends an endless run on request (the page's "Finish" button).
    function finishNow() {
      if (!session || finished) return;
      session.finish(performance.now());
      done();
    }

    // A short message that floats over the text and fades by itself. It takes no focus and never stops the clock.
    function toast(message, kind = "good") {
      toastEl.textContent = message;
      toastEl.className = "tl-toast show " + kind;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.className = "tl-toast"; }, 4200);
    }

    function showResults(node, announce) {
      play.hidden = true;
      clear(slot).append(node);
      slot.hidden = false;
      live.textContent = announce || "";
    }

    function hideResults() {
      slot.hidden = true;
      clear(slot);
      play.hidden = false;
      live.textContent = "";
    }

    function destroy() {
      destroyed = true;
      stopTimer();
      clearTimeout(toastTimer);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("keyup", onKeyup);
      root.removeEventListener("blur", onBlur);
      root.removeEventListener("resize", onResize);
      el.remove();
    }

    return {
      el, keyboard, load, restart, append, finishNow, toast, showResults, hideResults, destroy,
      get session() { return session; }, get finished() { return finished; },
    };
  }

  root.TL.ui.typing = { create };
})(window);
