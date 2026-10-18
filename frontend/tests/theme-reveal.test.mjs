import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({ entryPoints: ["src/utils/themeReveal.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { createThemeReveal, revealGeometry } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`);

for (const [width, height] of [[375, 812], [1920, 1080], [800, 600]]) {
  for (const point of [{ x: 0, y: 0 }, { x: width, y: height }, { x: width - 30, y: 200 }, undefined]) {
    const { x, y, radius } = revealGeometry(width, height, point);
    for (const [cx, cy] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      assert.ok(radius >= Math.hypot(x - cx, y - cy), "Circle covers every viewport corner");
    }
  }
}
assert.deepEqual(revealGeometry(100, 100, { x: -10, y: 200 }), { x: 0, y: 100, radius: 143 });

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let dark = false, supported = true, reduced = false, throws = false;
let visible = false;
const commits = [], transitions = [], circles = [];
const controller = createThemeReveal({
  current: () => dark,
  apply: next => { dark = next; commits.push(next); },
  supported: () => supported, reduced: () => reduced,
  viewport: () => ({ width: 375, height: 812 }),
  reveal: (point, radius) => { visible = true; circles.push({ point, radius }); },
  clear: () => { visible = false; },
  start: update => {
    if (throws) throw new Error("Snapshots unavailable");
    const ready = deferred(), finished = deferred();
    const transition = { ready: ready.promise, finished: finished.promise, skipped: false, skipTransition() { this.skipped = true; } };
    transitions.push({ transition, update, ready, finished });
    return transition;
  },
});
const drain = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

controller.toggle({ x: 330, y: 220 });
assert.equal(dark, false, "Theme changes in the browser snapshot callback");
assert.equal(circles.at(-1).point.x, 330);
controller.toggle();
assert.ok(transitions[0].transition.skipped);
transitions[0].update(); transitions[0].ready.reject(new Error("Skipped")); transitions[0].finished.resolve();
await drain();
assert.equal(dark, false, "Rapid second toggle cancels a pending dark theme");
assert.deepEqual(commits, []);

controller.toggle({ x: 300, y: 210 });
const toDark = transitions.at(-1);
toDark.update(); toDark.ready.resolve();
assert.equal(dark, true);
assert.equal(visible, true);
toDark.finished.resolve(); await drain();
assert.equal(visible, false);
controller.toggle({ x: 300, y: 210 });
const toLight = transitions.at(-1);
toLight.update(); toLight.ready.resolve(); toLight.finished.resolve(); await drain();
assert.equal(dark, false, "Light theme reveals in the same direction as dark theme");

supported = false;
controller.set(true);
assert.equal(dark, true);
assert.equal(visible, false);
supported = true; reduced = true;
controller.set(false);
assert.equal(dark, false);
reduced = false;
controller.set(true);
const rejected = transitions.at(-1);
rejected.ready.reject(new Error("Duplicate snapshot name"));
rejected.finished.reject(new Error("Skipped"));
await drain();
assert.equal(dark, true, "Failed snapshots still apply the selected theme");
assert.equal(visible, false);
throws = true;
controller.set(false);
assert.equal(dark, false, "Synchronous API failures also fall back");
throws = false;
controller.set(true);
const pending = transitions.at(-1);
controller.finish(); pending.update(); pending.ready.resolve(); pending.finished.resolve(); await drain();
assert.equal(dark, true, "Enabling reduced motion completes the latest selection immediately");
assert.equal(visible, false);
controller.set(false);
const disposed = transitions.at(-1);
controller.dispose(); disposed.update(); disposed.ready.resolve(); disposed.finished.resolve(); await drain();
assert.equal(dark, true, "Unmounted providers cannot apply delayed snapshot updates");
assert.equal(visible, false);
console.log("PASS: circular viewport coverage, both themes, rapid toggles, reduced motion, browser fallback, failed snapshots and cleanup.");
