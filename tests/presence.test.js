const test = require("node:test");
const assert = require("node:assert/strict");
const { Presence } = require("../js/core/presence.js");

// Runs the clock once a second for `seconds` and returns what was counted.
function run(p, from, seconds, visible = true) {
  let total = 0;
  for (let i = 1; i <= seconds; i++) total += p.step(from + i * 1000, visible);
  return total;
}

test("the clock starts when the player arrives and counts every second the tab is showing", () => {
  const p = new Presence({ now: 0 });
  assert.equal(p.step(0, true), 0, "the first step only sets the starting point");
  assert.equal(run(p, 0, 10), 10000);
  assert.equal(p.visitMs, 10000);
});

test("nothing counts while the tab is hidden, and counting carries on when it shows again", () => {
  const p = new Presence({ now: 0 });
  p.step(0, true);
  assert.equal(run(p, 0, 5), 5000);
  p.input(5000);
  assert.equal(run(p, 5000, 20, false), 0, "a hidden tab adds nothing");
  p.input(25000);
  assert.equal(run(p, 25000, 5), 5000);
});

test("a player who walks away stops counting after three minutes without any input", () => {
  const p = new Presence({ now: 0 });
  p.step(0, true);
  const counted = run(p, 0, 600);                 // ten minutes of an open page with no input at all
  assert.equal(counted, 180000, "three minutes, then it stops");
  assert.equal(p.idle, true);
  p.input(601000);
  assert.equal(p.step(602000, true), 2000, "any input starts it again (the step counts from the previous step, so up to a second extra)");
  assert.equal(p.idle, false);
});

test("a computer that sleeps, or a throttled background tab, cannot add a long gap in one step", () => {
  const p = new Presence({ now: 0 });
  p.step(0, true);
  p.input(0);
  assert.equal(p.step(100000, true), 2500, "one step adds at most 2.5 s");
  assert.equal(p.step(99000, true), 0, "a clock that went backwards adds nothing");
});
