const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/core/certificate.js");
const R = require("../js/core/rank.js");

const cert = (extra = {}) => ({ v: 1, n: "Mukeem Khan", t: "core", w: 62, a: 97, d: "2026-10-28", i: "TL-3F9A-72C1", ...extra });
const course = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { stars: 1 }]));

test("certificates become available as the course is passed", () => {
  const at = (n) => C.status(course(n), R.lessonRun).map((t) => [t.id, t.passed, t.done]);
  assert.deepEqual(at(0), [["core", 0, false], ["programmer", 0, false]]);
  assert.deepEqual(at(17), [["core", 17, false], ["programmer", 17, false]]);
  assert.deepEqual(at(18), [["core", 18, true], ["programmer", 18, false]]);
  assert.deepEqual(at(24), [["core", 18, true], ["programmer", 24, true]]);
});

test("a certificate code reads back to the same certificate", () => {
  const code = C.localCode(cert());
  assert.ok(code.endsWith(".local"));
  const back = C.decode(code);
  assert.deepEqual(back.cert, cert());
  assert.equal(back.signed, false);
  const signed = C.decode(C.localCode(cert()).replace(/\.local$/, ".AbCdEf0123456789AbCdEf"));
  assert.equal(signed.signed, true);
});

test("names with accents and other scripts survive the round trip", () => {
  for (const n of ["Zoë Müller", "Priya Nair", "李小龍 Lee", "O'Neil-Smith"]) {
    assert.equal(C.decode(C.localCode(cert({ n }))).cert.n, n);
  }
});

test("codes that are not certificates are refused", () => {
  const good = C.localCode(cert());
  const bad = [
    "", "abc", ".", "x.y", good.replace(".local", ""), "a".repeat(3000) + ".x",
    C.localCode(cert({ t: "gold" })), C.localCode(cert({ n: "A" })), C.localCode(cert({ n: "N".repeat(25) })),
    C.localCode(cert({ w: 999 })), C.localCode(cert({ a: -1 })), C.localCode(cert({ d: "yesterday" })),
    C.localCode(cert({ i: "<script>" })), C.localCode(cert({ v: 2 })), 42, null, undefined,
  ];
  for (const code of bad) assert.equal(C.decode(code), null, String(code).slice(0, 40));
});

test("the picture is a complete SVG with the facts on it", () => {
  const svg = C.svg(cert(), "https://typelab.pages.dev/");
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  for (const part of ["Mukeem Khan", "Touch Typing", "62 WPM", "97%", "28 October 2026", "TL-3F9A-72C1", "typelab.pages.dev", "18"]) {
    assert.ok(svg.includes(part), `missing "${part}"`);
  }
  assert.ok(C.svg(cert({ t: "programmer" }), "x.io").includes("Touch Typing for Programmers"));
  assert.ok(C.svg(cert({ t: "programmer" }), "x.io").includes("24"));
});

test("a name cannot break out of the picture", () => {
  const evil = cert({ n: "<b>\"x\"&</b>" });
  const svg = C.svg(evil, "https://a.b/\"><script>");
  assert.ok(!/<script/i.test(svg) && !svg.includes("<b>"));
  assert.ok(svg.includes("&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;"));
  assert.ok(!/<script|<image|<foreignObject|\son\w+=|href=/i.test(C.svg(cert(), "https://typelab.pages.dev/")), "only shapes and text");
});

test("the picture can be used as an image address", () => {
  const url = C.dataUrl(C.svg(cert(), "x.io"));
  assert.ok(url.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg"));
  assert.ok(!url.includes(" "), "no raw spaces");
});

test("the certificate page link keeps the site address and drops any old hash", () => {
  assert.equal(C.pageUrl("https://typelab.pages.dev/", "abc.def"), "https://typelab.pages.dev/#/certificate/abc.def");
  assert.equal(C.pageUrl("https://typelab.pages.dev/#/practice", "abc.def"), "https://typelab.pages.dev/#/certificate/abc.def");
});

test("share links carry the page address and the facts, safely encoded", () => {
  const url = "https://typelab.pages.dev/#/certificate/abc.def";
  const links = C.shareLinks(url, cert());
  assert.deepEqual(links.map((l) => l.id), ["whatsapp", "linkedin", "linkedin-profile", "x", "facebook", "email"]);
  for (const l of links) {
    assert.ok(l.href.startsWith("https://") || l.href.startsWith("mailto:"), l.id);
    assert.ok(l.href.includes(encodeURIComponent(url)) || l.id === "whatsapp" || l.id === "email", l.id);
    assert.ok(!/[ "<>]/.test(l.href), `${l.id} has unencoded characters`);
  }
  const profile = links.find((l) => l.id === "linkedin-profile").href;
  assert.ok(profile.includes("issueYear=2026") && profile.includes("issueMonth=10") && profile.includes("certId=TL-3F9A-72C1"));
  assert.ok(decodeURIComponent(links[0].href).includes("62 WPM at 97% accuracy"));
});
