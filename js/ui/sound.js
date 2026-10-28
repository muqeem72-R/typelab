/* TypeLab sounds, made with Web Audio so there are no sound files to ship.

   ok      a short, soft tick for a correct key
   wrong   a low, dull buzz for a wrong key
   wrong2  a harder double buzz when the same character is missed twice (or more) in a row
   done    a small rising chime when a session ends
   level   a very soft two-note rise when a new level is reached in the middle of a run

   The audio context is created on the first sound, which always follows a key press, so the
   browser's "sound needs a user action first" rule is satisfied. */
(function (root) {
  "use strict";

  let ctx = null;
  let master = null;

  function ready(volume) {
    try {
      if (!ctx) {
        ctx = new (root.AudioContext || root.webkitAudioContext)();
        master = ctx.createGain();
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      master.gain.value = Math.min(1, Math.max(0, volume / 100));
      return true;
    } catch (e) {
      return false;   // no audio available: stay silent
    }
  }

  // One shaped tone: a quick attack, then a fade out over `dur` seconds.
  function tone({ type, from, to, start = 0, dur, gain, lowpass }) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let source = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpass;
      osc.connect(filter);
      source = filter;
    }
    source.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  const KINDS = {
    ok: () => tone({ type: "triangle", from: 760, to: 520, dur: 0.05, gain: 0.35 }),
    wrong: () => tone({ type: "sawtooth", from: 170, to: 110, dur: 0.16, gain: 0.3, lowpass: 800 }),
    wrong2: () => {
      tone({ type: "square", from: 150, to: 90, dur: 0.12, gain: 0.3, lowpass: 1100 });
      tone({ type: "square", from: 125, to: 70, start: 0.13, dur: 0.16, gain: 0.34, lowpass: 1000 });
    },
    done: () => [523.25, 659.25, 783.99].forEach((f, i) => tone({ type: "sine", from: f, start: i * 0.09, dur: 0.3, gain: 0.25 })),
    // Quiet on purpose: it plays while you are still typing and must not distract.
    level: () => [659.25, 987.77].forEach((f, i) => tone({ type: "sine", from: f, start: i * 0.08, dur: 0.22, gain: 0.12 })),
  };

  // Which sound a key press deserves. streak is the wrong-keys-in-a-row count from the engine.
  const forPress = (res) => (res.ok ? "ok" : res.streak >= 2 ? "wrong2" : "wrong");

  function play(kind, volume = 60) {
    if (KINDS[kind] && ready(volume)) KINDS[kind]();
  }

  root.TL.ui.sound = { play, forPress };
})(window);
