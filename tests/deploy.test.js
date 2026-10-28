const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
// wrangler.jsonc allows whole-line // comments
const config = JSON.parse(read("wrangler.jsonc").split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join("\n"));

test("the Worker config matches the Cloudflare project and only runs for the API", () => {
  assert.equal(config.name, "typelab");
  assert.ok(fs.existsSync(path.join(root, config.main)), "the Worker file exists");
  assert.deepEqual(config.assets.run_worker_first, ["/api/*"]);
  assert.equal(config.assets.directory, ".");
  assert.ok(config.kv_namespaces.some((k) => k.binding === "TYPELAB"), "the KV binding the Worker reads is declared");
  assert.equal(config.keep_vars, true, "mail variables set in the dashboard survive a deploy");
});

test("the files that are not the website are kept out of what Cloudflare serves", () => {
  const ignored = read(".assetsignore").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  for (const entry of ["node_modules", ".git", "/server/", "/worker/", "/tests/", "/tools/", "/wrangler.jsonc", "/package.json"]) {
    assert.ok(ignored.includes(entry), `${entry} must be in .assetsignore (a single 137 MiB file in node_modules once made a deploy fail)`);
  }
});

test("the old Cloudflare Pages setup is gone, so it cannot disagree with the Worker", () => {
  assert.equal(fs.existsSync(path.join(root, "functions")), false);
  assert.equal(fs.existsSync(path.join(root, "_routes.json")), false);
});

test("the Worker answers only /api/ and hands everything to the same server logic", () => {
  const worker = read("worker/index.js");
  assert.match(worker, /from "\.\.\/server\/core\.mjs"/);
  assert.match(worker, /from "\.\.\/server\/mail\.mjs"/);
  assert.match(worker, /export default \{/);
});
