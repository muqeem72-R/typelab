const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html");
const meta = (attr, name) => {
  const m = new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};
const canonical = (/<link rel="canonical" href="([^"]+)"/.exec(html) || [])[1];

test("the site has one address, and every place that names it agrees", () => {
  assert.match(canonical, /^https:\/\/[^/\s]+\/$/, "the canonical address is a full https address ending in a slash");
  const config = /siteUrl: "([^"]*)"/.exec(read("js/config.js"))[1];
  assert.equal(config, canonical, "js/config.js siteUrl");
  assert.equal(meta("property", "og:url"), canonical);
  assert.equal(JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]).url, canonical);
  assert.match(read("sitemap.xml"), new RegExp(`<loc>${canonical.replace(/[.]/g, "\\.")}</loc>`));
  assert.match(read("robots.txt"), new RegExp(`^Sitemap: ${canonical.replace(/[.]/g, "\\.")}sitemap\\.xml$`, "m"));
});

test("the title and description are the right length for a search result", () => {
  const title = /<title>([^<]*)<\/title>/.exec(html)[1];
  const description = meta("name", "description");
  assert.ok(title.length >= 20 && title.length <= 70, `title is ${title.length} characters`);
  assert.ok(description.length >= 70 && description.length <= 160, `description is ${description.length} characters`);
  assert.match(title, /touch typing/i);
  assert.equal(meta("property", "og:title"), title);
  assert.equal(meta("property", "og:description"), description);
  assert.equal(meta("name", "twitter:description"), description);
});

test("pages may be indexed, and the API may not", () => {
  assert.match(meta("name", "robots"), /^index, follow/);
  assert.ok(!/noindex/i.test(html));
  const robots = read("robots.txt");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
});

test("the sitemap is a valid list of addresses on the same site", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 1);
  for (const loc of locs) assert.ok(loc.startsWith(canonical), loc);
  assert.match(xml, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test("the picture shown when a link is shared exists, and is 1200 by 630", () => {
  const image = meta("property", "og:image");
  assert.equal(image, canonical + "assets/social-card.png");
  assert.equal(meta("name", "twitter:image"), image);
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  const file = fs.readFileSync(path.join(root, "assets/social-card.png"));
  assert.equal(file.subarray(1, 4).toString(), "PNG");
  assert.equal(file.readUInt32BE(16), 1200);
  assert.equal(file.readUInt32BE(20), 630);
  assert.ok(file.length < 600 * 1024, "small enough for WhatsApp and LinkedIn previews");
  assert.equal(meta("property", "og:image:width"), "1200");
  assert.equal(meta("property", "og:image:height"), "630");
});

test("the structured data says what the site is", () => {
  const data = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.name, "TypeLab");
  assert.equal(data.isAccessibleForFree, true);
  assert.equal(data.offers.price, "0");
  assert.equal(data.description, meta("name", "description"));
});

test("the page a visitor lands on carries the site's description", () => {
  const login = read("js/pages/login.js");
  assert.match(login, /fullTitle: "TypeLab: free touch typing practice, course and certificate"/);
  assert.match(login, /free touch typing trainer/);
  assert.match(read("js/app.js"), /page\.fullTitle \|\|/);
});

test("a Google Search Console verification file is answered exactly where Google looks, without a redirect", () => {
  assert.equal(fs.readdirSync(root).filter((f) => /^google[a-f0-9]{16}\.html$/.test(f)).length, 0, "as a static file Cloudflare would redirect it to a name without .html");
  const worker = read("worker/index.js");
  const names = /VERIFICATION_FILES = \[([^\]]*)\]/.exec(worker)[1].match(/google[a-f0-9]{16}\.html/g);
  assert.ok(names && names.length >= 1);
  const config = read("wrangler.jsonc");
  for (const n of names) assert.ok(config.includes('"/' + n + '"'), n + " must be in run_worker_first");
});
