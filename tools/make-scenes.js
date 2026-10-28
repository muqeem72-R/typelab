/* Draws the background scenes for the themes: `node tools/make-scenes.js`.
   Every scene is a plain 1600 x 900 SVG written to assets/scenes/<id>.svg. They are generated
   with a seeded random source, so running this again gives byte-identical files.
   Dark scenes belong to the dark theme, light scenes to the light theme. */
const fs = require("node:fs");
const path = require("node:path");

const W = 1600;
const H = 900;
const OUT = path.resolve(__dirname, "..", "assets", "scenes");

// ---------- helpers ----------------------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v) => Math.round(v * 10) / 10;
const between = (r, a, b) => a + (b - a) * r();
const pick = (r, list) => list[Math.floor(r() * list.length)];

const doc = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">\n<defs>${defs}</defs>\n${body}\n</svg>\n`;

const stop = (o, c, a) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ""}/>`;
const linear = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((s) => stop(...s)).join("")}</linearGradient>`;
const radial = (id, stops) => `<radialGradient id="${id}">${stops.map((s) => stop(...s)).join("")}</radialGradient>`;
const blur = (id, sd) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const sky = (id) => `<rect width="${W}" height="${H}" fill="url(#${id})"/>`;

// Many small stars as one group. `skip(x, y)` keeps an area clear (for the moon).
function stars(r, count, { y1 = 560, rMin = 0.5, rMax = 1.5, color = "#fff", fade = true, skip = null, x0 = 0, x1 = W } = {}) {
  let out = `<g fill="${color}">`;
  for (let i = 0; i < count; i++) {
    const x = between(r, x0, x1);
    const y = between(r, 0, y1);
    if (skip && skip(x, y)) continue;
    const op = (fade ? 1 - (y / y1) * 0.75 : 1) * between(r, 0.35, 1);
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(between(r, rMin, rMax))}" opacity="${n(op)}"/>`;
  }
  return out + "</g>";
}

// A few bright stars with a soft glow and a small cross.
function brightStars(r, count, { y1 = 420, color = "#fff", skip = null } = {}) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = between(r, 40, W - 40);
    const y = between(r, 20, y1);
    if (skip && skip(x, y)) continue;
    const s = between(r, 1.4, 2.4);
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 5)}" fill="${color}" opacity=".13"/>`;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${color}"/>`;
    if (i % 2 === 0) out += `<path d="M${n(x - s * 6)} ${n(y)}H${n(x + s * 6)}M${n(x)} ${n(y - s * 6)}V${n(y + s * 6)}" stroke="${color}" stroke-width=".8" opacity=".55"/>`;
  }
  return out;
}

// Rolling ground built from three sine waves; returns a closed path to the bottom edge.
function hills(r, baseY, amp, { step = 20, f = [0.004, 0.011, 0.027] } = {}) {
  const p = [between(r, 0, 6), between(r, 0, 6), between(r, 0, 6)];
  const a = [0.55, 0.3, 0.15];
  let d = `M0 ${H}`;
  for (let x = 0; x <= W + step; x += step) {
    let v = 0;
    for (let k = 0; k < 3; k++) v += a[k] * (0.5 + 0.5 * Math.sin(x * f[k] + p[k]));
    d += `L${x} ${n(baseY - amp * v)}`;
  }
  return d + `L${W} ${H}Z`;
}

// Jagged mountain range. Returns the path and the peaks so snow can be added.
function mountains(r, baseY, minH, maxH, count) {
  const pts = [];
  const peaks = [];
  const stepX = (W + 200) / count;
  for (let i = 0; i <= count; i++) {
    const x = -100 + i * stepX + between(r, -stepX * 0.2, stepX * 0.2);
    const h = between(r, minH, maxH);
    pts.push([x, baseY - h]);
    peaks.push({ x, y: baseY - h, h });
    const vx = x + stepX / 2 + between(r, -stepX * 0.15, stepX * 0.15);
    pts.push([vx, baseY - between(r, 0, minH * 0.45)]);
  }
  const d = `M-100 ${H}L-100 ${baseY}` + pts.map(([x, y]) => `L${n(x)} ${n(y)}`).join("") + `L${W + 100} ${H}Z`;
  return { d, peaks };
}

function snow(peaks, fill, opacity = 1, depth = 0.34) {
  let out = `<g fill="${fill}" opacity="${opacity}">`;
  for (const p of peaks) {
    const w = p.h * 0.32;
    const d = p.h * depth;
    out += `<path d="M${n(p.x)} ${n(p.y)}L${n(p.x + w)} ${n(p.y + d * 0.85)}L${n(p.x + w * 0.45)} ${n(p.y + d * 0.65)}L${n(p.x + w * 0.1)} ${n(p.y + d)}L${n(p.x - w * 0.35)} ${n(p.y + d * 0.62)}L${n(p.x - w)} ${n(p.y + d * 0.85)}Z"/>`;
  }
  return out + "</g>";
}

// A row of pine trees standing on a baseline that follows `groundY(x)`.
function pines(r, x0, x1, groundY, hMin, hMax, gap, fill, opacity = 1) {
  let d = "";
  for (let x = x0; x < x1; x += between(r, gap * 0.6, gap * 1.3)) {
    const h = between(r, hMin, hMax);
    const w = h * 0.34;
    const y = groundY(x);
    d += `M${n(x - w)} ${n(y)}L${n(x - w * 0.55)} ${n(y - h * 0.38)}L${n(x - w * 0.8)} ${n(y - h * 0.38)}L${n(x - w * 0.35)} ${n(y - h * 0.68)}L${n(x - w * 0.55)} ${n(y - h * 0.68)}L${n(x)} ${n(y - h)}L${n(x + w * 0.55)} ${n(y - h * 0.68)}L${n(x + w * 0.35)} ${n(y - h * 0.68)}L${n(x + w * 0.8)} ${n(y - h * 0.38)}L${n(x + w * 0.55)} ${n(y - h * 0.38)}L${n(x + w)} ${n(y)}Z`;
  }
  return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
}

const cloud = (x, y, s, fill, op = 1) =>
  `<g transform="translate(${n(x)} ${n(y)}) scale(${s})" fill="${fill}" opacity="${op}"><ellipse cx="0" cy="0" rx="96" ry="26"/><ellipse cx="-44" cy="-14" rx="44" ry="30"/><ellipse cx="12" cy="-28" rx="54" ry="38"/><ellipse cx="66" cy="-8" rx="40" ry="26"/></g>`;

const streak = (x, y, w, h, fill, op, filter) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w)}" ry="${n(h)}" fill="${fill}" opacity="${op}"${filter ? ` filter="url(#${filter})"` : ""}/>`;

const bird = (x, y, s, color, op = 0.7) =>
  `<path d="M${n(x)} ${n(y)}q${n(7 * s)} ${n(-8 * s)} ${n(14 * s)} 0q${n(7 * s)} ${n(-8 * s)} ${n(14 * s)} 0" fill="none" stroke="${color}" stroke-width="${n(1.6 * s)}" stroke-linecap="round" opacity="${op}"/>`;

const wave = (y, amp, len, phase, step = 16) => {
  let d = `M-20 ${n(y)}`;
  for (let x = -20; x <= W + 20; x += step) d += `L${x} ${n(y + amp * Math.sin((x / len) * Math.PI * 2 + phase))}`;
  return d;
};

// A skyline layer. Returns the buildings as one path and the lit windows as another.
function skyline(r, { baseY, minH, maxH, minW, maxW, lit, gx = 15, gy = 20 }) {
  let body = "";
  let wins = "";
  let extras = "";
  let x = -30;
  while (x < W + 30) {
    const w = between(r, minW, maxW);
    const h = between(r, minH, maxH);
    const top = baseY - h;
    body += `M${n(x)} ${H}V${n(top)}H${n(x + w)}V${H}Z`;
    const cols = Math.floor((w - 10) / gx);
    const rows = Math.floor((h - 16) / gy);
    for (let rr = 0; rr < rows; rr++) {
      for (let c = 0; c < cols; c++) {
        if (r() < lit) wins += `M${n(x + 6 + c * gx)} ${n(top + 10 + rr * gy)}h6v9h-6z`;
      }
    }
    if (r() < 0.28) extras += `<path d="M${n(x + w / 2)} ${n(top)}V${n(top - between(r, 24, 60))}" stroke="currentColor" stroke-width="2"/>`;
    x += w + between(r, 0, 5);
  }
  return { body, wins, extras };
}

// A palm tree with a leaning trunk and eight fronds. (x, y) is where the trunk meets the ground.
function palm(x, y, s, { trunk, trunkLight = null, fronds: [c1, c2] }) {
  const dirs = [[-1, 0.1], [-0.75, -0.45], [-0.3, -0.75], [0.25, -0.8], [0.75, -0.5], [1, 0.05], [0.45, 0.45], [-0.5, 0.45]];
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0C18 -120 24 -230 60 -330" stroke="${trunk}" stroke-width="22" fill="none" stroke-linecap="round"/>` +
    (trunkLight ? `<path d="M0 0C18 -120 24 -230 60 -330" stroke="${trunkLight}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".6"/>` : "") +
    `<g transform="translate(60 -330)">` + dirs.map(([dx, dy], i) =>
      `<path d="M0 0Q${n(dx * 110)} ${n(dy * 110 - 70)} ${n(dx * 230)} ${n(dy * 190 + 40)}Q${n(dx * 110)} ${n(dy * 110 - 20)} 0 14Z" fill="${i % 2 ? c1 : c2}"/>`).join("") +
    `<circle cx="-6" cy="12" r="10" fill="${trunk}"/><circle cx="12" cy="16" r="10" fill="${trunk}"/></g></g>`;
}

const crescent = (cx, cy, rad, fill) =>
  `<path d="M${n(cx)} ${n(cy - rad)}A${rad} ${rad} 0 1 0 ${n(cx + rad * 0.2)} ${n(cy + rad * 0.98)}A${n(rad * 0.82)} ${n(rad * 0.82)} 0 1 1 ${n(cx)} ${n(cy - rad)}Z" fill="${fill}"/>`;

// ---------- dark scenes -----------------------------------------------------------------------

function nightSky() {
  const r = rng(11);
  const defs = linear("sky", [[0, "#040816"], [0.5, "#0b1b48"], [1, "#22397f"]]) + blur("b30", 30) + blur("b3", 3) +
    linear("shoot", [[0, "#fff", 0], [1, "#fff", 0.95]], 0, 0, 1, 0);
  const band = `<g transform="rotate(-26 800 330)" fill="#b3c1ff" filter="url(#b30)">` +
    [[800, 330, 760, 70, 0.16], [560, 340, 420, 50, 0.14], [1060, 320, 380, 46, 0.12], [800, 340, 900, 130, 0.07], [300, 350, 260, 40, 0.1]]
      .map(([x, y, rx, ry, o]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" opacity="${o}"/>`).join("") + "</g>";
  // extra stars crowded along the band
  let dust = `<g fill="#dfe6ff">`;
  for (let i = 0; i < 190; i++) {
    const t = between(r, -1, 1);
    const off = (r() + r() + r() - 1.5) * 90;
    const a = (-26 * Math.PI) / 180;
    const x = 800 + t * 780 * Math.cos(a) - off * Math.sin(a);
    const y = 330 + t * 780 * Math.sin(a) + off * Math.cos(a);
    if (y > 0 && y < 560) dust += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(between(r, 0.4, 1.1))}" opacity="${n(between(r, 0.3, 0.9))}"/>`;
  }
  dust += "</g>";
  const ground = (x) => 760 - 70 * (0.5 + 0.5 * Math.sin(x * 0.006 + 1.2));
  const body = sky("sky") + band + dust + stars(r, 260) + brightStars(r, 16) +
    `<path d="M1180 120L1020 190" stroke="url(#shoot)" stroke-width="2" stroke-linecap="round"/><path d="M420 90L330 128" stroke="url(#shoot)" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="${hills(r, 740, 150)}" fill="#0a1334"/>` +
    `<path d="${hills(r, 800, 110, { f: [0.006, 0.015, 0.03] })}" fill="#060c24"/>` +
    pines(r, 20, W, ground, 50, 120, 36, "#040919", 1) +
    `<rect y="840" width="${W}" height="60" fill="#040919"/>`;
  return doc(defs, body);
}

function moon() {
  const r = rng(23);
  const mx = 1180, my = 230;
  const defs = linear("sky", [[0, "#050a22"], [0.55, "#16235e"], [1, "#324891"]]) +
    radial("halo", [[0, "#fff7d6", 0.34], [0.35, "#e9efff", 0.14], [1, "#e9efff", 0]]) +
    radial("disc", [[0, "#fffdf0"], [1, "#f0e8c8"]]) + blur("b6", 6) + blur("b14", 14) +
    linear("lake", [[0, "#23346f"], [1, "#0a1232"]]);
  const near = (x, y) => Math.hypot(x - mx, y - my) < 150;
  const craters = [[-30, -24, 22], [34, 8, 16], [-8, 40, 12], [22, -44, 9], [-46, 22, 8], [10, 12, 6]]
    .map(([dx, dy, rr]) => `<circle cx="${mx + dx}" cy="${my + dy}" r="${rr}" fill="#d8cfa8" opacity=".45"/>`).join("");
  const clouds = streak(mx - 60, my + 30, 260, 12, "#aab9ea", 0.28, "b6") + streak(mx + 120, my - 40, 220, 9, "#aab9ea", 0.22, "b6") +
    streak(400, 300, 300, 14, "#8b9ede", 0.18, "b14") + streak(900, 410, 380, 16, "#8b9ede", 0.14, "b14");
  const ground = (x) => 700 - 60 * (0.5 + 0.5 * Math.sin(x * 0.007 + 0.4));
  const tree = `<path d="M230 780V620M230 700L190 650M230 680L275 626M230 650L205 596M230 640L252 590" stroke="#040a1e" stroke-width="8" stroke-linecap="round" fill="none"/>` +
    `<g fill="#040a1e"><ellipse cx="190" cy="636" rx="40" ry="30"/><ellipse cx="276" cy="612" rx="46" ry="34"/><ellipse cx="205" cy="580" rx="44" ry="34"/><ellipse cx="254" cy="574" rx="40" ry="30"/><ellipse cx="228" cy="610" rx="50" ry="36"/></g>`;
  let reflect = "";
  for (let y = 740; y < 880; y += 9) {
    const w = 18 + (y - 740) * 0.9;
    reflect += `<rect x="${n(mx - w / 2 + between(r, -10, 10))}" y="${y}" width="${n(w)}" height="3" rx="1.5" fill="#fff4cf" opacity="${n(0.5 - (y - 740) / 360)}"/>`;
  }
  const body = sky("sky") + stars(r, 170, { skip: near, y1: 520 }) + brightStars(r, 8, { skip: near }) +
    `<circle cx="${mx}" cy="${my}" r="480" fill="url(#halo)"/><circle cx="${mx}" cy="${my}" r="230" fill="url(#halo)"/>` +
    `<circle cx="${mx}" cy="${my}" r="104" fill="url(#disc)"/>${craters}` + clouds +
    `<path d="${hills(r, 640, 110, { f: [0.005, 0.013, 0.03] })}" fill="#111c4a"/>` +
    `<path d="${hills(r, 730, 80)}" fill="#0a1236"/>` +
    `<rect y="730" width="${W}" height="${H - 730}" fill="url(#lake)"/>` + reflect +
    `<path d="${hills(r, 790, 40)}" fill="#050a22"/>` + tree + pines(r, 900, W, ground, 30, 70, 30, "#050a22");
  return doc(defs, body);
}

function cityNight() {
  const r = rng(37);
  const defs = linear("sky", [[0, "#070b2a"], [0.55, "#221f68"], [0.82, "#6b3f8d"], [1, "#d37a96"]]) + blur("b4", 4) +
    radial("glow", [[0, "#ffb2a0", 0.55], [1, "#ffb2a0", 0]]);
  const far = skyline(r, { baseY: 640, minH: 150, maxH: 330, minW: 46, maxW: 100, lit: 0.18, gx: 13, gy: 18 });
  const mid = skyline(r, { baseY: 700, minH: 180, maxH: 440, minW: 52, maxW: 120, lit: 0.3 });
  const near = skyline(r, { baseY: 790, minH: 100, maxH: 330, minW: 60, maxW: 150, lit: 0.36, gx: 17, gy: 22 });
  let lamps = "";
  for (let x = 40; x < W; x += 110) lamps += `<circle cx="${x}" cy="842" r="3" fill="#ffd9a0"/><circle cx="${x}" cy="842" r="14" fill="#ffd9a0" opacity=".2"/>`;
  // a tall tower with a red light
  const tower = `<path d="M1180 ${H}V300L1190 280V250L1200 250V280L1210 300V${H}Z" fill="#0c0f33"/><path d="M1195 250V200" stroke="#0c0f33" stroke-width="3"/><circle cx="1195" cy="196" r="4" fill="#ff4d4d"/><circle cx="1195" cy="196" r="12" fill="#ff4d4d" opacity=".25"/>`;
  const body = sky("sky") + `<ellipse cx="800" cy="720" rx="900" ry="260" fill="url(#glow)"/>` + stars(r, 150, { y1: 460 }) + brightStars(r, 8, { y1: 300 }) +
    crescent(260, 170, 46, "#fbf2cf") + `<circle cx="260" cy="170" r="110" fill="#fff3c8" opacity=".07"/>` +
    `<path d="${far.body}" fill="#2b2a73" opacity=".9"/><path d="${far.wins}" fill="#9a97e8" opacity=".55"/>` +
    `<path d="${mid.body}" fill="#161855"/><path d="${mid.wins}" fill="#ffd27a" opacity=".85"/><g color="#161855">${mid.extras}</g>` + tower +
    `<path d="${near.body}" fill="#0a0c2c"/><path d="${near.wins}" fill="#ffe3a3" opacity=".9"/><g color="#0a0c2c">${near.extras}</g>` +
    `<rect y="840" width="${W}" height="60" fill="#05061b"/>` + lamps;
  return doc(defs, body);
}

function seaNight() {
  const r = rng(51);
  const mx = 1100, my = 190, horizon = 560;
  const defs = linear("sky", [[0, "#030816"], [0.6, "#102868"], [1, "#3b5fa3"]]) +
    linear("sea", [[0, "#12336f"], [0.5, "#08204b"], [1, "#030c20"]]) +
    radial("halo", [[0, "#fff4cf", 0.4], [1, "#fff4cf", 0]]) + linear("beam", [[0, "#fff6c8", 0.7], [1, "#fff6c8", 0]], 0, 0, 1, 0);
  const near = (x, y) => Math.hypot(x - mx, y - my) < 120;
  let reflect = "";
  for (let y = horizon + 8; y < 880; y += 7) {
    const k = (y - horizon) / 320;
    for (let i = 0; i < 3; i++) {
      const w = (14 + k * 150) * between(r, 0.25, 1);
      reflect += `<rect x="${n(mx - w / 2 + between(r, -k * 60, k * 60))}" y="${y}" width="${n(w)}" height="${n(2 + k * 2)}" rx="1.5" fill="#fff0c0" opacity="${n(Math.max(0.05, 0.55 - k * 0.45))}"/>`;
    }
  }
  let waves = `<g fill="none" stroke="#8fb2f0" stroke-linecap="round">`;
  for (let i = 0; i < 26; i++) {
    const y = horizon + 14 + i * i * 0.42 + i * 6;
    waves += `<path d="${wave(y, 1.5 + i * 0.22, 140 + i * 18, between(r, 0, 6))}" stroke-width="${n(0.8 + i * 0.05)}" opacity="${n(0.06 + i * 0.006)}"/>`;
  }
  waves += "</g>";
  const lighthouse = `<path d="M170 ${horizon + 6}h110l-18 -34h-74z" fill="#050b20"/><path d="M205 ${horizon - 28}l8 -90h14l8 90z" fill="#0a1230"/><rect x="204" y="${horizon - 124}" width="32" height="14" fill="#fff0b0"/><path d="M200 ${horizon - 124}h40l-20 -18z" fill="#050b20"/>` +
    `<path d="M236 ${horizon - 117}L760 ${horizon - 190}V${horizon - 40}Z" fill="url(#beam)" opacity=".5"/>`;
  const boat = `<path d="M540 ${horizon + 4}l60 0l-12 14h-36z" fill="#040a1c"/><path d="M570 ${horizon + 4}V${horizon - 62}l36 56z" fill="#0b1432"/><path d="M566 ${horizon + 4}V${horizon - 48}l-26 46z" fill="#08102a"/>`;
  const body = sky("sky") + stars(r, 210, { skip: near, y1: horizon - 20 }) + brightStars(r, 10, { skip: near, y1: 380 }) +
    `<circle cx="${mx}" cy="${my}" r="360" fill="url(#halo)"/><circle cx="${mx}" cy="${my}" r="64" fill="#fff8de"/>` +
    streak(mx - 20, my + 18, 150, 7, "#9fb4ea", 0.3) +
    `<path d="M0 ${horizon}H${W}" stroke="#7f9fdc" stroke-width="1" opacity=".5"/>` +
    `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#sea)"/>` + waves + reflect + lighthouse + boat;
  return doc(defs, body);
}

function aurora() {
  const r = rng(63);
  const defs = linear("sky", [[0, "#02060f"], [0.55, "#082033"], [1, "#0f3b45"]]) + blur("b16", 16) + blur("b8", 8) +
    linear("g1", [[0, "#2cf5a0", 0], [0.35, "#3df5b0", 0.85], [0.7, "#17c3a5", 0.4], [1, "#17c3a5", 0]]) +
    linear("g2", [[0, "#9b6bff", 0], [0.4, "#b07dff", 0.6], [1, "#7a5cff", 0]]) +
    linear("g3", [[0, "#5ff7e0", 0], [0.5, "#4de0f0", 0.55], [1, "#35a0ff", 0]]);
  const ribbon = (y0, amp, len, phase, thick, grad, op, blurId) => {
    let top = "";
    let bottom = "";
    for (let x = -40; x <= W + 40; x += 24) {
      const y = y0 + amp * Math.sin((x / len) * Math.PI * 2 + phase) + amp * 0.4 * Math.sin((x / (len * 0.43)) * Math.PI * 2 + phase * 1.7);
      top += `${x === -40 ? "M" : "L"}${x} ${n(y)}`;
      bottom = `L${x} ${n(y + thick + 40 * Math.sin(x / 90 + phase))}` + bottom;
    }
    return `<path d="${top}${bottom}Z" fill="url(#${grad})" opacity="${op}" filter="url(#${blurId})"/>`;
  };
  const rays = (() => {
    let s = `<g stroke="#5ff7c8" stroke-linecap="round" filter="url(#b8)">`;
    for (let x = 80; x < W; x += 34) {
      const y = 260 + 90 * Math.sin((x / 700) * Math.PI * 2 + 0.6);
      s += `<line x1="${x}" y1="${n(y)}" x2="${x + between(r, -6, 6)}" y2="${n(y + between(r, 80, 220))}" stroke-width="${n(between(r, 2, 6))}" opacity="${n(between(r, 0.06, 0.2))}"/>`;
    }
    return s + "</g>";
  })();
  const farM = mountains(r, 720, 160, 330, 7);
  const ground = (x) => 810 - 40 * (0.5 + 0.5 * Math.sin(x * 0.008));
  const body = sky("sky") + stars(r, 240, { y1: 520 }) + brightStars(r, 8, { y1: 260 }) +
    ribbon(210, 70, 700, 0.4, 150, "g2", 0.5, "b16") + ribbon(250, 85, 620, 2.1, 190, "g3", 0.5, "b16") +
    ribbon(300, 90, 560, 1.2, 220, "g1", 0.85, "b16") + ribbon(340, 60, 480, 4.0, 90, "g1", 0.7, "b8") + rays +
    `<path d="${farM.d}" fill="#0a1c2e"/>` + snow(farM.peaks, "#9fd7e8", 0.28) +
    `<path d="${hills(r, 760, 90)}" fill="#06121f"/>` +
    pines(r, 0, W, ground, 60, 170, 34, "#030a12") + `<rect y="830" width="${W}" height="70" fill="#030a12"/>`;
  return doc(defs, body);
}

function desertNight() {
  const r = rng(79);
  const mx = 1260, my = 180;
  const defs = linear("sky", [[0, "#050722"], [0.55, "#1d1b58"], [0.85, "#523a78"], [1, "#b05c72"]]) +
    radial("halo", [[0, "#fff1c4", 0.35], [1, "#fff1c4", 0]]) + radial("horizon", [[0, "#ffb27a", 0.5], [1, "#ffb27a", 0]]);
  const near = (x, y) => Math.hypot(x - mx, y - my) < 130;
  // Crenellated wall: small square teeth along the top edge.
  const teeth = (x0, x1, y, w = 12, h = 12) => {
    let d = "";
    for (let x = x0; x < x1 - w; x += w * 2) d += `M${x} ${y}h${w}v${-h}h${-w}z`;
    return d;
  };
  const fx = 1010, fy = 600;
  const fort = `<g fill="#1a1442">` +
    `<path d="M${fx} ${fy + 140}V${fy}H${fx + 420}V${fy + 140}Z"/><path d="${teeth(fx, fx + 420, fy)}"/>` +
    [[fx - 14, 56, 120], [fx + 170, 60, 150], [fx + 380, 56, 118]].map(([x, w, h]) =>
      `<path d="M${x} ${fy + 140}V${fy - h}H${x + w}V${fy + 140}Z"/><path d="${teeth(x, x + w, fy - h, 10, 10)}"/><path d="M${x + 6} ${fy - h - 10}a${w / 2 - 6} ${w / 2 - 6} 0 0 1 ${w - 12} 0z"/>`).join("") +
    `<path d="M${fx + 120} ${fy}V${fy - 90}H${fx + 300}V${fy}Z"/><path d="M${fx + 130} ${fy - 100}a40 40 0 0 1 80 0zM${fx + 220} ${fy - 100}a40 40 0 0 1 80 0z"/>` + `</g>` +
    `<g fill="#ffd27a" opacity=".85"><rect x="${fx + 190}" y="${fy - 120}" width="9" height="16" rx="4"/><rect x="${fx + 40}" y="${fy - 40}" width="8" height="14" rx="4"/><rect x="${fx + 330}" y="${fy - 50}" width="8" height="14" rx="4"/><rect x="${fx + 150}" y="${fy - 60}" width="8" height="14" rx="4"/><rect x="${fx + 268}" y="${fy - 62}" width="8" height="14" rx="4"/></g>`;
  const dune = (baseY, amp, fill, seed, rim) => {
    const rr = rng(seed);
    const d = hills(rr, baseY, amp, { step: 16, f: [0.0035, 0.009, 0.02] });
    return `<path d="${d}" fill="${fill}"/>` + (rim ? `<path d="${d.replace(/^M0 \d+/, "M0 " + H).replace(/L\d+ \d+Z$/, "")}" fill="none" stroke="${rim}" stroke-width="2" opacity=".5"/>` : "");
  };
  const tree = palm(250, 850, 0.78, { trunk: "#07051c", fronds: ["#07051c", "#0b0826"] });
  const body = sky("sky") + `<ellipse cx="800" cy="640" rx="900" ry="190" fill="url(#horizon)"/>` +
    stars(r, 230, { skip: near, y1: 480 }) + brightStars(r, 10, { skip: near, y1: 330 }) +
    `<circle cx="${mx}" cy="${my}" r="320" fill="url(#halo)"/>` + crescent(mx, my, 70, "#fff3cf") + fort +
    dune(650, 90, "#2b2255", 3, "#8d6cc0") + dune(720, 95, "#1b1540", 5, "#7a5ab0") + dune(800, 70, "#0e0a26", 9, "#6a4f9a") + tree;
  return doc(defs, body);
}

// ---------- light scenes ----------------------------------------------------------------------

function sunrise() {
  const r = rng(101);
  const sx = 800, sy = 600;
  const defs = linear("sky", [[0, "#86bff0"], [0.42, "#cfe3f6"], [0.72, "#fde6bd"], [1, "#ffcf9e"]]) +
    radial("halo", [[0, "#fff6cf", 0.95], [0.25, "#ffe9a8", 0.5], [1, "#ffe9a8", 0]]) +
    radial("disc", [[0, "#fffdf0"], [1, "#ffe39a"]]) + blur("b10", 10) +
    linear("mist", [[0, "#fff", 0], [1, "#fff", 0.55]]) +
    linear("field", [[0, "#9ccf84"], [1, "#74b062"]]) + linear("ray", [[0, "#fff6cf", 0.5], [1, "#fff6cf", 0]]);
  let rays = "";
  for (let i = 0; i < 14; i++) {
    const a = ((-170 + i * 14.6) * Math.PI) / 180;
    const w = 0.035;
    rays += `<path d="M${sx} ${sy}L${n(sx + 1500 * Math.cos(a - w))} ${n(sy + 1500 * Math.sin(a - w))}L${n(sx + 1500 * Math.cos(a + w))} ${n(sy + 1500 * Math.sin(a + w))}Z" fill="url(#ray)" opacity=".28"/>`;
  }
  const body = sky("sky") + `<circle cx="${sx}" cy="${sy}" r="620" fill="url(#halo)"/>` + rays +
    streak(260, 250, 240, 18, "#fff", 0.8, "b10") + streak(1250, 190, 280, 20, "#ffe9e4", 0.85, "b10") + streak(980, 380, 200, 14, "#fff2dd", 0.8, "b10") +
    cloud(420, 340, 1, "#fff", 0.85) + cloud(1180, 300, 1.2, "#fff6ee", 0.9) +
    `<circle cx="${sx}" cy="${sy}" r="72" fill="url(#disc)"/>` +
    `<path d="${hills(r, 640, 90, { f: [0.004, 0.01, 0.025] })}" fill="#c4d8cb"/>` +
    `<rect y="560" width="${W}" height="140" fill="url(#mist)"/>` +
    `<path d="${hills(r, 690, 80)}" fill="#a9cfa0"/>` +
    `<path d="${hills(r, 760, 70, { f: [0.005, 0.012, 0.03] })}" fill="url(#field)"/>` +
    `<path d="${hills(r, 840, 50)}" fill="#6aa65b"/>` +
    bird(300, 200, 1.2, "#56688a") + bird(350, 230, 0.9, "#56688a") + bird(1040, 160, 1, "#56688a") + bird(1100, 190, 0.8, "#56688a") + bird(700, 120, 0.9, "#56688a");
  return doc(defs, body);
}

function sunset() {
  const r = rng(113);
  const sx = 1020, horizon = 600;
  const defs = linear("sky", [[0, "#5876c2"], [0.3, "#a58cca"], [0.55, "#f0a4b6"], [0.8, "#ffb47e"], [1, "#ffd89c"]]) +
    linear("sea", [[0, "#f2a77c"], [0.35, "#c7769b"], [1, "#8d6fb0"]]) +
    radial("halo", [[0, "#fff0c0", 0.95], [0.3, "#ffc27e", 0.5], [1, "#ffb070", 0]]) +
    radial("disc", [[0, "#fff6d8"], [1, "#ffbe78"]]) + blur("b12", 12) + blur("b4", 4);
  let glints = "";
  for (let y = horizon + 10; y < 860; y += 8) {
    const k = (y - horizon) / 260;
    for (let i = 0; i < 3; i++) {
      const w = (12 + k * 170) * between(r, 0.2, 1);
      glints += `<rect x="${n(sx - w / 2 + between(r, -k * 50, k * 50))}" y="${y}" width="${n(w)}" height="${n(2 + k * 2)}" rx="1.5" fill="#fff3cf" opacity="${n(Math.max(0.06, 0.7 - k * 0.55))}"/>`;
    }
  }
  let waves = `<g fill="none" stroke="#fff0e0" stroke-linecap="round">`;
  for (let i = 0; i < 18; i++) waves += `<path d="${wave(horizon + 20 + i * i * 0.6 + i * 8, 1.4 + i * 0.2, 150 + i * 16, between(r, 0, 6))}" stroke-width="${n(0.8 + i * 0.05)}" opacity="${n(0.06 + i * 0.005)}"/>`;
  waves += "</g>";
  const body = sky("sky") + `<circle cx="${sx}" cy="${horizon}" r="560" fill="url(#halo)"/>` +
    streak(300, 220, 340, 20, "#ffd6c4", 0.75, "b12") + streak(780, 330, 360, 16, "#f6a6b8", 0.8, "b12") + streak(1300, 250, 300, 18, "#d99ac8", 0.7, "b12") +
    streak(520, 470, 420, 14, "#ffcfa8", 0.8, "b4") + streak(1180, 440, 300, 10, "#ffb890", 0.85, "b4") + streak(160, 400, 220, 10, "#e9a3c4", 0.7, "b4") +
    `<circle cx="${sx}" cy="${horizon - 4}" r="80" fill="url(#disc)"/>` +
    streak(sx - 40, horizon - 26, 260, 10, "#f7b0a0", 0.85, "b4") +
    `<path d="M0 ${horizon}H${W}V${H}H0Z" fill="url(#sea)"/>` + waves + glints +
    `<path d="M-20 ${horizon}C100 ${horizon - 50} 180 ${horizon - 20} 300 ${horizon - 8}L320 ${horizon}Z" fill="#9378b4" opacity=".85"/>` +
    bird(380, 160, 1.2, "#6a4f86") + bird(430, 190, 0.9, "#6a4f86") + bird(1260, 130, 1, "#6a4f86") + bird(1320, 160, 0.8, "#6a4f86");
  return doc(defs, body);
}

function park() {
  const r = rng(127);
  const defs = linear("sky", [[0, "#8dd0f6"], [0.55, "#d3eefc"], [1, "#eef9ff"]]) + radial("halo", [[0, "#fff9d8", 0.9], [1, "#fff9d8", 0]]) +
    linear("lawn", [[0, "#9ad970"], [0.5, "#74c25a"], [1, "#5aab48"]]) + blur("b6", 6);
  const treeAt = (x, y, s, canopy, light) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-9 0L-6 -90H6L9 0Z" fill="#8a5f3d"/>` +
    `<g fill="${canopy}"><circle cx="0" cy="-130" r="70"/><circle cx="-56" cy="-100" r="48"/><circle cx="58" cy="-102" r="50"/><circle cx="-24" cy="-170" r="48"/><circle cx="32" cy="-168" r="46"/></g>` +
    `<g fill="${light}" opacity=".55"><circle cx="-22" cy="-150" r="30"/><circle cx="30" cy="-178" r="22"/><circle cx="-62" cy="-108" r="20"/></g></g>`;
  let flowers = "";
  const colors = ["#ff8fb1", "#ffd84d", "#ffffff", "#b497ff", "#ff9f6e"];
  for (let i = 0; i < 90; i++) {
    const x = between(r, 0, W);
    const y = between(r, 690, 880);
    const c = pick(r, colors);
    const s = 1.5 + (y - 690) / 70;
    flowers += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${c}"/>`;
  }
  // winding path in perspective, from the horizon to the bottom edge
  const path = `<path d="M720 640C760 680 700 720 640 760C560 810 520 850 500 ${H}H1060C1020 850 930 800 900 750C880 710 850 680 790 640Z" fill="#efdcab"/>` +
    `<path d="M740 640C780 680 730 722 670 764C600 812 560 850 545 ${H}H1020C990 850 910 800 880 752C860 714 830 682 780 640Z" fill="#f6e8c4" opacity=".7"/>`;
  const bench = `<g transform="translate(1130 800)"><rect x="-46" y="-34" width="92" height="9" rx="2" fill="#7a4f33"/><rect x="-46" y="-22" width="92" height="9" rx="2" fill="#8c5c3a"/><rect x="-46" y="-8" width="92" height="9" rx="2" fill="#7a4f33"/><rect x="-42" y="0" width="7" height="26" fill="#3d3d4a"/><rect x="35" y="0" width="7" height="26" fill="#3d3d4a"/></g>`;
  const lamp = `<g transform="translate(1000 780)"><rect x="-3" y="-120" width="6" height="124" fill="#3b4256"/><path d="M-14 -120h28l-6 -18h-16z" fill="#3b4256"/><circle cx="0" cy="-114" r="9" fill="#fff0b0"/></g>`;
  const butterfly = (x, y, c) => `<g transform="translate(${x} ${y})"><ellipse cx="-6" cy="-3" rx="7" ry="5" fill="${c}"/><ellipse cx="6" cy="-3" rx="7" ry="5" fill="${c}"/><ellipse cx="-5" cy="4" rx="5" ry="4" fill="${c}" opacity=".85"/><ellipse cx="5" cy="4" rx="5" ry="4" fill="${c}" opacity=".85"/><rect x="-1" y="-6" width="2" height="14" fill="#3b3350"/></g>`;
  const body = sky("sky") + `<circle cx="210" cy="150" r="300" fill="url(#halo)"/><circle cx="210" cy="150" r="46" fill="#fff6c2"/>` +
    cloud(600, 190, 1.3, "#fff", 0.95) + cloud(1160, 140, 1.1, "#fff", 0.95) + cloud(1420, 300, 0.9, "#fff", 0.9) + cloud(330, 340, 0.8, "#fff", 0.85) +
    `<path d="${hills(r, 560, 70, { f: [0.004, 0.009, 0.02] })}" fill="#b4dba8"/>` +
    // distant tree line
    (() => { let s = `<g fill="#7fc075">`; for (let x = 0; x < W; x += 30) s += `<circle cx="${x + between(r, -8, 8)}" cy="${n(572 + between(r, -10, 14))}" r="${n(between(r, 26, 44))}"/>`; return s + "</g>"; })() +
    `<path d="${hills(r, 640, 50)}" fill="url(#lawn)"/>` + treeAt(190, 650, 0.7, "#5fb25a", "#8fd685") + treeAt(1370, 640, 0.75, "#58a854", "#86cf7e") +
    `<path d="${hills(r, 700, 40)}" fill="#6dbb55"/>` + path + `<rect y="880" width="${W}" height="20" fill="#5aab48"/>` + flowers +
    treeAt(250, 800, 1.5, "#4f9f4c", "#7bc673") + treeAt(1420, 810, 1.7, "#4a9a48", "#76c06c") + bench + lamp +
    butterfly(600, 600, "#ff8fb1") + butterfly(1210, 690, "#ffc94a") +
    bird(820, 150, 1, "#5c6f8e") + bird(870, 175, 0.8, "#5c6f8e") + bird(480, 90, 0.9, "#5c6f8e");
  return doc(defs, body);
}

function beach() {
  const r = rng(139);
  const hz = 470;
  const defs = linear("sky", [[0, "#6ac4f5"], [0.6, "#cdeeff"], [1, "#f2fbff"]]) + radial("halo", [[0, "#fffbe0", 0.9], [1, "#fffbe0", 0]]) +
    linear("sea", [[0, "#1fb3c8"], [0.5, "#4ccfd5"], [1, "#a2e8e0"]]) + linear("sand", [[0, "#f7e9c3"], [1, "#ecd6a0"]]);
  let waves = `<g fill="none" stroke="#fff" stroke-linecap="round">`;
  for (let i = 0; i < 16; i++) waves += `<path d="${wave(hz + 16 + i * i * 0.9 + i * 10, 1.6 + i * 0.3, 160 + i * 20, between(r, 0, 6))}" stroke-width="${n(0.9 + i * 0.07)}" opacity="${n(0.18 + i * 0.012)}"/>`;
  waves += "</g>";
  const shoreY = 715;
  const foam = `<path d="${wave(shoreY, 8, 260, 0.5, 20)}L${W + 20} ${H}L-20 ${H}Z" fill="#fff" opacity=".85"/>`;
  const palmAt = (x, y, s) => palm(x, y, s, { trunk: "#7a5a3a", trunkLight: "#9c7a54", fronds: ["#2f9d57", "#3fb86a"] });
  const umbrella = `<g transform="translate(1330 800)"><path d="M0 0L-12 -150" stroke="#6a4a30" stroke-width="5"/><path d="M-12 -150C-120 -150 -150 -100 -150 -80H120C120 -100 90 -150 -12 -150Z" fill="#ff6b6b"/><path d="M-12 -150C-60 -150 -66 -100 -50 -80H0C-6 -100 -2 -150 -12 -150Z" fill="#fff" opacity=".9"/><path d="M-12 -150C40 -150 60 -100 70 -80H120C120 -100 90 -150 -12 -150Z" fill="#fff" opacity=".9"/><ellipse cx="-20" cy="22" rx="80" ry="14" fill="#5aa7e8" opacity=".85"/></g>`;
  const island = `<path d="M980 ${hz}C1020 ${hz - 40} 1070 ${hz - 60} 1120 ${hz - 40}C1160 ${hz - 30} 1190 ${hz - 10} 1210 ${hz}Z" fill="#7fb59a"/>`;
  const sail = `<path d="M520 ${hz + 18}h70l-12 12h-46z" fill="#fff"/><path d="M556 ${hz + 18}V${hz - 40}l32 56z" fill="#fff"/><path d="M552 ${hz + 18}V${hz - 28}l-22 44z" fill="#ffe3e3"/>`;
  const body = sky("sky") + `<circle cx="1250" cy="150" r="320" fill="url(#halo)"/><circle cx="1250" cy="150" r="52" fill="#fffbe0"/>` +
    cloud(420, 200, 1.2, "#fff", 0.95) + cloud(900, 130, 1, "#fff", 0.9) + cloud(1480, 330, 0.9, "#fff", 0.9) + island +
    `<rect y="${hz}" width="${W}" height="${shoreY - hz + 20}" fill="url(#sea)"/>` + waves + sail + foam +
    `<path d="M-20 ${shoreY + 40}${wave(shoreY + 40, 6, 300, 1.2, 30).slice(0)}" fill="none"/>` +
    `<rect y="${shoreY + 20}" width="${W}" height="${H}" fill="url(#sand)" opacity=".0"/>` +
    `<path d="M0 ${shoreY + 30}Q400 ${shoreY + 10} 800 ${shoreY + 34}T1600 ${shoreY + 26}V${H}H0Z" fill="url(#sand)"/>` +
    palmAt(150, 880, 1.15) + umbrella +
    `<g fill="#fff" opacity=".9"><ellipse cx="760" cy="840" rx="14" ry="8"/></g>` +
    bird(700, 220, 1.1, "#4b6a88") + bird(750, 250, 0.9, "#4b6a88") + bird(1040, 100, 1, "#4b6a88");
  return doc(defs, body);
}

function mountainsDay() {
  const r = rng(151);
  const defs = linear("sky", [[0, "#7fb6ee"], [0.6, "#d6e8fa"], [1, "#f4faff"]]) + radial("halo", [[0, "#fffbe6", 0.9], [1, "#fffbe6", 0]]) +
    linear("lake", [[0, "#a7cdea"], [1, "#6fa3cf"]]);
  const far = mountains(r, 640, 220, 380, 6);
  const mid = mountains(r, 680, 160, 300, 7);
  const near = mountains(r, 720, 100, 210, 8);
  const lakeTop = 680;
  const gL = (x) => 840 - 20 * (0.5 + 0.5 * Math.sin(x * 0.01));
  const body = sky("sky") + `<circle cx="1320" cy="150" r="320" fill="url(#halo)"/><circle cx="1320" cy="150" r="48" fill="#fffbe6"/>` +
    cloud(360, 210, 1.2, "#fff", 0.95) + cloud(900, 120, 1, "#fff", 0.95) + cloud(1180, 330, 0.8, "#fff", 0.85) +
    `<path d="${far.d}" fill="#b9cdea"/>` + snow(far.peaks, "#fff", 0.95) +
    `<path d="${mid.d}" fill="#93addb"/>` + snow(mid.peaks, "#f4f8ff", 0.9) +
    `<path d="${near.d}" fill="#6f8fc6"/>` + snow(near.peaks, "#eaf1ff", 0.8, 0.26) +
    `<rect y="${lakeTop}" width="${W}" height="${H - lakeTop}" fill="url(#lake)"/>` +
    `<g opacity=".28" transform="translate(0 ${2 * lakeTop}) scale(1 -1)"><path d="${near.d}" fill="#6f8fc6"/></g>` +
    `<g fill="none" stroke="#fff" stroke-linecap="round">` + Array.from({ length: 10 }, (_, i) => `<path d="${wave(lakeTop + 20 + i * 16, 1.2, 120 + i * 12, between(r, 0, 6))}" stroke-width="1" opacity="${n(0.12 + i * 0.01)}"/>`).join("") + `</g>` +
    pines(r, -20, 520, gL, 90, 230, 40, "#2f6a52") + pines(r, 1080, W + 20, gL, 90, 250, 40, "#2f6a52") +
    pines(r, -20, 380, (x) => gL(x) + 40, 120, 280, 46, "#255a44") + pines(r, 1240, W + 20, (x) => gL(x) + 46, 120, 300, 46, "#255a44") +
    `<path d="${hills(r, 860, 24)}" fill="#255a44"/>` +
    bird(640, 190, 1.1, "#54698c") + bird(690, 215, 0.9, "#54698c");
  return doc(defs, body);
}

function cloudSea() {
  const r = rng(163);
  const defs = linear("sky", [[0, "#4f9fec"], [0.45, "#9ccbf6"], [0.8, "#dcedfc"], [1, "#fff1da"]]) +
    radial("halo", [[0, "#fffbe6", 0.95], [1, "#fffbe6", 0]]) + linear("beam", [[0, "#fffbe6", 0.5], [1, "#fffbe6", 0]]) +
    linear("bank", [[0, "#ffffff"], [1, "#d9e9f9"]]) + blur("b8", 8);
  let beams = "";
  [-34, -22, -10, 2].forEach((a, i) => {
    const ang = ((90 + a) * Math.PI) / 180;
    beams += `<path d="M1240 120L${n(1240 + 1400 * Math.cos(ang - 0.05))} ${n(120 + 1400 * Math.sin(ang - 0.05))}L${n(1240 + 1400 * Math.cos(ang + 0.05))} ${n(120 + 1400 * Math.sin(ang + 0.05))}Z" fill="url(#beam)" opacity="${n(0.22 - i * 0.03)}"/>`;
  });
  const bank = (y, amp, scale, fill, op) => {
    let s = `<g fill="${fill}" opacity="${op}">`;
    for (let x = -80; x < W + 120; x += 90 * scale) {
      s += `<ellipse cx="${n(x + between(r, -20, 20))}" cy="${n(y + between(r, -amp, amp))}" rx="${n(between(r, 90, 150) * scale)}" ry="${n(between(r, 44, 80) * scale)}"/>`;
    }
    return s + `<rect x="-100" y="${y + 20}" width="${W + 200}" height="${H}"/></g>`;
  };
  const peak = `<path d="M130 760L330 470L360 500L420 410L520 560L600 760Z" fill="#7e9fd0"/><path d="M330 470L420 410L440 440L400 470L370 460L360 500Z" fill="#fff" opacity=".9"/>`;
  const body = sky("sky") + `<circle cx="1240" cy="120" r="480" fill="url(#halo)"/><circle cx="1240" cy="120" r="54" fill="#fffbe6"/>` + beams +
    cloud(360, 200, 1.1, "#fff", 0.7) + cloud(820, 300, 1.4, "#fff", 0.6) + cloud(1480, 380, 1, "#fff", 0.7) +
    peak + bank(640, 14, 1.1, "#e8f2fc", 0.9) + bank(710, 16, 1.2, "#f6fbff", 0.95) +
    bank(790, 18, 1.3, "#ffffff", 1) + bank(850, 12, 1.4, "#e5f0fb", 1) +
    bird(560, 150, 1.1, "#56698a") + bird(610, 175, 0.9, "#56698a") + bird(980, 240, 1, "#56698a");
  return doc(defs, body);
}

// ---------- write -------------------------------------------------------------------------------

const SCENES = {
  "night-sky": nightSky, moon, "city-night": cityNight, "sea-night": seaNight, aurora, "desert-night": desertNight,
  sunrise, sunset, park, beach, mountains: mountainsDay, "cloud-sea": cloudSea,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [id, make] of Object.entries(SCENES)) {
  const svgText = make();
  fs.writeFileSync(path.join(OUT, id + ".svg"), svgText);
  console.log(id.padEnd(14), (Buffer.byteLength(svgText) / 1024).toFixed(1) + " KB");
}
