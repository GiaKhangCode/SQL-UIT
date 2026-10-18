import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({ entryPoints: ["src/i18n/motion.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { createLanguageMotion, createDomLanguageMotion, languageMotion } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`);

function clock() {
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    timer(callback, delay) { tasks.set(++id, { callback, delay }); return id; },
    clear(id) { tasks.delete(id); },
    run() {
      assert.equal(tasks.size, 1, "One shared clock, regardless of text count");
      const [id, task] = tasks.entries().next().value;
      tasks.delete(id); task.callback(); return task.delay;
    },
  };
}
const time = clock();
let language = "vi", reduced = false, phase = "idle", commits = [];
const labels = Array.from({ length: 500 }, () => ({
  delay: null, cleared: 0, resized: 0, width: 40,
  activate(delay) { this.delay = delay; },
  deactivate() { this.cleared++; },
  resize(width) { assert.equal(width, 40); this.resized++; },
}));
const controller = createLanguageMotion({
  current: () => language,
  commit: next => { language = next; commits.push(next); },
  reduced: () => reduced,
  labels: () => labels,
  phase: next => { phase = next; },
  timer: time.timer, clear: time.clear,
});
controller.request("en");
assert.equal(language, "vi", "Old text stays mounted during exit");
assert.equal(phase, "out");
assert.equal(labels.filter(label => label.delay !== null).length, languageMotion.maxLabels);
assert.ok(labels.every(label => label.delay === null || label.delay <= languageMotion.maxDelayMs));
controller.request("en");
assert.equal(time.tasks.size, 1, "Repeated selection does not restart or multiply timers");
assert.equal(time.run(), languageMotion.exitMs + languageMotion.maxDelayMs);
assert.equal(language, "en");
controller.committed("en");
assert.equal(phase, "in");
assert.equal(labels.filter(label => label.resized).length, languageMotion.maxLabels);
assert.equal(time.run(), languageMotion.enterMs + languageMotion.maxDelayMs);
assert.equal(phase, "idle");
assert.equal(time.tasks.size, 0);

controller.request("vi");
controller.request("en");
assert.equal(time.tasks.size, 0, "Returning to the current language cancels a pending swap");
assert.equal(language, "en");
controller.request("vi");
controller.finish();
assert.equal(language, "vi");
assert.equal(time.tasks.size, 0, "Reduced motion/background flush cannot leave stale timers");
assert.equal(phase, "idle");
reduced = true;
controller.request("en");
assert.equal(language, "en");
assert.equal(time.tasks.size, 0);
reduced = false;
controller.request("vi");
controller.dispose();
assert.equal(time.tasks.size, 0);
assert.equal(language, "en", "Unmount cancels rather than committing a stale request");

const delayedTime = clock();
const queuedCommits = [];
const delayed = createLanguageMotion({
  current: () => "vi", // Simulate React having queued, but not committed, a render.
  commit: language => queuedCommits.push(language),
  reduced: () => false, labels: () => labels.slice(0, 1), phase: () => {},
  timer: delayedTime.timer, clear: delayedTime.clear,
});
delayed.request("en"); delayedTime.run(); delayed.request("vi");
assert.deepEqual(queuedCommits, ["en", "vi"], "Latest selection overrides a queued React commit");
assert.equal(delayedTime.tasks.size, 0);
delayed.dispose();

// Exercise the DOM adapter with deterministic viewport/intersection observations.
const domTime = clock();
const intersections = [];
let disconnected = 0;
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; intersections.push(this); }
  observe() {}
  unobserve() {}
  disconnect() { disconnected++; }
};
globalThis.document = { hidden: false, documentElement: { dataset: {} } };
globalThis.window = {
  innerWidth: 1000, innerHeight: 700,
  matchMedia: () => ({ matches: false }),
  setTimeout: domTime.timer, clearTimeout: domTime.clear,
};
function element(top, hidden = false) {
  const animations = [];
  return {
    isConnected: true, textContent: "Edit", dataset: {}, animations, width: 40,
    style: { setProperty() {}, removeProperty() {} },
    hasAttribute(name) { return name === "data-resize" && this.dataset.resize !== undefined; },
    closest() { return hidden ? {} : null; },
    getBoundingClientRect() { return { top, bottom: top + 20, left: 10, right: 10 + this.width, width: this.width, height: 20 }; },
    animate(frames, options) { const animation = { frames, options, canceled: false, cancel() { this.canceled = true; } }; animations.push(animation); return animation; },
  };
}
language = "vi";
const dom = createDomLanguageMotion(() => language, next => { language = next; });
const visible = element(20), clipped = element(50), below = element(900), hidden = element(60, true);
const cleanups = [visible, clipped, below, hidden].map(node => dom.register(node, true));
assert.equal(intersections.length, 1, "All labels share one IntersectionObserver");
intersections[0].callback([
  { target: visible, isIntersecting: true }, { target: clipped, isIntersecting: false },
  { target: below, isIntersecting: true }, { target: hidden, isIntersecting: true },
]);
dom.request("en");
assert.equal(visible.dataset.motionActive, "true");
for (const node of [clipped, below, hidden]) assert.equal(node.dataset.motionActive, undefined);
domTime.run();
visible.width = 70;
dom.committed("en");
assert.equal(visible.animations.length, 1);
assert.deepEqual(visible.animations[0].frames, [{ width: "40px" }, { width: "70px" }]);
domTime.run();
assert.ok(visible.animations[0].canceled);
assert.equal(visible.dataset.motionActive, undefined);
cleanups.forEach(cleanup => cleanup());
assert.equal(disconnected, 1);
dom.request("vi");
assert.equal(language, "vi", "With no visible labels, selection commits immediately");
assert.equal(domTime.tasks.size, 0);
dom.dispose();
delete globalThis.window; delete globalThis.document; delete globalThis.IntersectionObserver;
console.log("PASS: shared transition clocks, visible-label budget, scroll clipping, width animation, rapid selections, reduced motion and cleanup.");
