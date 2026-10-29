const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// themes.js needs a browser, so read its scene list as text.
const themesSource = read("js/ui/themes.js");
const block = themesSource.match(/const SCENES = \[([\s\S]*?)\n  \];/);
assert.ok(block, "could not find the scene list");
const scenes = [...block[1].matchAll(/\["([a-z-]+)", "[^"]+"\]/g)].map((m) => m[1]);
const dark = scenes.slice(6);
const light = scenes.slice(0, 6);

test("there is one list of twelve pictures, every picture goes with every theme, and none is listed twice", () => {
  assert.equal(scenes.length, 12);
  assert.equal(new Set(scenes).size, 12);
  assert.ok(!/SCENES\[t\]|SCENES\.dark|SCENES\.light/.test(themesSource), "the picker must not pick pictures by the theme's tone");
});

test("the picture is one saved choice, not one per tone", () => {
  assert.match(themesSource, /const SCENE_KEY = "typeLab\.scene";/);
  const head = read("js/theme.js");
  assert.match(head, /get\("typeLab\.scene"\)/);
  assert.ok(!/setScene\(t, /.test(themesSource));
});

test("every listed scene has a stylesheet rule and a picture, and nothing else is left over", () => {
  const css = read("css/scenes.css");
  const inCss = [...css.matchAll(/^\[data-scene="([a-z-]+)"\] \{ --scn: url\("\.\.\/assets\/scenes\/([a-z-]+)\.svg"\); \}$/gm)];
  for (const [, id, file] of inCss) assert.equal(id, file, `rule for ${id} points at ${file}.svg`);
  const ids = inCss.map((m) => m[1]).sort();
  assert.deepEqual(ids, [...dark, ...light].sort());
  const files = fs.readdirSync(path.join(root, "assets", "scenes")).filter((f) => f.endsWith(".svg")).map((f) => f.replace(".svg", "")).sort();
  assert.deepEqual(files, ids);
});

test("scene pictures are small, self-contained SVGs", () => {
  for (const id of [...dark, ...light]) {
    const file = path.join(root, "assets", "scenes", id + ".svg");
    const text = fs.readFileSync(file, "utf8");
    assert.ok(text.startsWith("<svg "), `${id} does not start with <svg`);
    assert.ok(text.trimEnd().endsWith("</svg>"), `${id} does not end with </svg>`);
    assert.ok(fs.statSync(file).size < 120 * 1024, `${id} is larger than 120 KB`);
    assert.ok(!/<script|<image|<foreignObject|\son\w+=|href=/i.test(text), `${id} contains something other than shapes`);
    assert.ok(/viewBox="0 0 1600 900"/.test(text), `${id} has the wrong viewBox`);
  }
});

test("the scene generator is repeatable: running it again changes nothing", () => {
  const { execFileSync } = require("node:child_process");
  const before = [...dark, ...light].map((id) => read(`assets/scenes/${id}.svg`));
  execFileSync(process.execPath, [path.join(root, "tools", "make-scenes.js")], { stdio: "ignore" });
  const after = [...dark, ...light].map((id) => read(`assets/scenes/${id}.svg`));
  assert.deepEqual(after, before);
});

test("the page loads the theme files, with no inline script or style", () => {
  const html = read("index.html");
  for (const f of ["css/scenes.css", "css/social.css", "css/practice.css", "js/data/places.js", "js/ui/accountform.js", "css/course.css", "css/presence.css", "css/admin.css", "js/pages/admin.js", "js/core/presence.js", "js/ui/visit.js", "js/config.js", "js/ui/themes.js", "js/ui/sound.js", "js/ui/hands.js", "js/ui/tour.js", "js/data/code.js", "js/core/rank.js", "js/core/certificate.js", "js/core/account.js", "js/pages/login.js", "js/pages/social.js", "js/pages/certificate.js"]) assert.ok(html.includes(f), `${f} is not loaded`);
  assert.ok(!html.includes("js/pages/test.js"), "the old separate test page is gone");
  assert.ok(!/<script(?![^>]*(\bsrc=|type="application\/ld\+json"))/i.test(html), "inline <script> found");
  assert.ok(!/<style|\sstyle=/i.test(html), "inline style found");
});
