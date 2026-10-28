/* TypeLab metrics: speed, accuracy, consistency, smoothing and the progress projection.
   Pure functions only, so they run in the browser and in the Node tests. */
(function (root) {
  "use strict";

  const MIN_MS = 50;    // a faster interval is key rollover, not typing
  const MAX_MS = 2000;  // a slower interval is a pause, not typing speed

  const clampInterval = (ms) => Math.min(MAX_MS, Math.max(MIN_MS, ms));

  // One "word" is 5 characters, so a key typed every `ms` milliseconds is 12000 / ms WPM.
  const speedFromMs = (ms) => 12000 / ms;
  const msFromSpeed = (wpm) => 12000 / wpm;
  const wpm = (chars, ms) => (ms > 0 ? chars / 5 / (ms / 60000) : 0);
  const accuracy = (correct, total) => (total > 0 ? (correct / total) * 100 : 100);
  const ema = (prev, sample, alpha) => (prev == null ? sample : prev + alpha * (sample - prev));
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // 0-100, higher is steadier. Maps the coefficient of variation of the key intervals
  // through 1 - tanh(cv + cv^3/3 + cv^5/5) so that ordinary typists land between 40 and 85.
  function consistency(intervals) {
    const xs = intervals.filter((v) => v > 0);
    if (xs.length < 5) return null;
    const m = mean(xs);
    const sd = Math.sqrt(mean(xs.map((v) => (v - m) ** 2)));
    const cv = sd / m;
    return Math.round(100 * (1 - Math.tanh(cv + cv ** 3 / 3 + cv ** 5 / 5)));
  }

  // Per-second series for the result chart. `events` are { t, c, ok } in time order,
  // where c is the number of correct characters after the event.
  // A long run is thinned to about `maxPoints` points so the chart stays readable.
  function series(events, endMs, maxPoints = 120) {
    const out = [];
    const seconds = Math.max(1, Math.ceil(endMs / 1000));
    const step = Math.max(1, Math.ceil(seconds / maxPoints));
    let i = 0;
    let correct = 0;
    let typed = 0;
    for (let s = step; s - step < seconds; s += step) {
      const at = Math.min(Math.min(s, seconds) * 1000, endMs);
      let errors = 0;
      while (i < events.length && events[i].t <= at) {
        const e = events[i++];
        correct = e.c;
        typed++;
        if (!e.ok) errors++;
      }
      out.push({ s: at / 1000, wpm: wpm(correct, at), raw: wpm(typed, at), errors });
    }
    return out;
  }

  // Least-squares polynomial fit through the normal equations. x is rescaled to 0..1
  // first so that cubes of large lesson numbers cannot ruin the conditioning.
  function polyFit(xs, ys, degree) {
    const n = xs.length;
    const m = degree + 1;
    if (n < m + 1) return null;
    const x0 = xs[0];
    const scale = xs[n - 1] - xs[0] || 1;
    const u = xs.map((x) => (x - x0) / scale);
    const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < m; c++) A[r][c] += u[i] ** (r + c);
        A[r][m] += ys[i] * u[i] ** r;
      }
    }
    for (let col = 0; col < m; col++) {
      let p = col;
      for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[p][col])) p = r;
      [A[col], A[p]] = [A[p], A[col]];
      if (Math.abs(A[col][col]) < 1e-12) return null;
      for (let r = col + 1; r < m; r++) {
        const f = A[r][col] / A[col][col];
        for (let c = col; c <= m; c++) A[r][c] -= f * A[col][c];
      }
    }
    const coef = new Array(m);
    for (let r = m - 1; r >= 0; r--) {
      let s = A[r][m];
      for (let c = r + 1; c < m; c++) s -= A[r][c] * coef[c];
      coef[r] = s / A[r][r];
    }
    return {
      eval(x) {
        const t = (x - x0) / scale;
        let y = 0;
        for (let k = m - 1; k >= 0; k--) y = y * t + coef[k];
        return y;
      },
      slope(x) {
        const t = (x - x0) / scale;
        let y = 0;
        for (let k = m - 1; k >= 1; k--) y = y * t + k * coef[k];
        return y / scale;
      },
    };
  }

  function r2(xs, ys, model) {
    const m = mean(ys);
    let tot = 0;
    let res = 0;
    for (let i = 0; i < xs.length; i++) {
      tot += (ys[i] - m) ** 2;
      res += (ys[i] - model.eval(xs[i])) ** 2;
    }
    return tot === 0 ? 0 : 1 - res / tot;
  }

  // Looks at the last 30 session speeds and says how many more sessions it takes to reach
  // the target if the trend continues. Returns null when the trend is too noisy to trust.
  function projection(speeds, targetWpm) {
    const ys = speeds.slice(-30);
    if (ys.length < 5) return null;
    const xs = ys.map((_, i) => i + 1);
    const model = polyFit(xs, ys, ys.length > 12 ? 2 : 1);
    if (!model) return null;
    const certainty = r2(xs, ys, model);
    if (certainty < 0.5) return null;
    const last = ys.length;
    let remaining = null;
    if (model.eval(last) >= targetWpm) remaining = 0;
    else {
      for (let i = 1; i <= 50; i++) {
        if (model.eval(last + i) >= targetWpm) { remaining = i; break; }
      }
    }
    return { certainty, rate: model.slope(last), remaining };
  }

  const api = {
    MIN_MS, MAX_MS, clampInterval, speedFromMs, msFromSpeed, wpm, accuracy, ema, mean,
    consistency, series, polyFit, r2, projection,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).metrics = api;
})(typeof window !== "undefined" ? window : globalThis);
