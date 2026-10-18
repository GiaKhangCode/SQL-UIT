import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
for (const key of ["window", "document", "HTMLElement", "Node"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
globalThis.__solutionRun = async (payload) => {
  calls.push(payload);
  return { status: "Success", executionTimeMs: calls.length === 1 ? 1.25 : 2.5,
    table: { name: "Result", columns: ["n"], rows: [[1]] } };
};
const require = createRequire(import.meta.url);
const output = await build({
  stdin: { contents: `
    import React, { act, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { Simulate } from 'react-dom/test-utils';
    import { TeacherSqlSolutions, initialSqlSolutions } from './src/pages/teacher/problem-editor/TeacherSqlSolutions';
    let latest;
    let expected;
    let visible;
    const runningChange = () => {};
    function Harness() {
      const [solutions, setSolutions] = useState(() => initialSqlSolutions(undefined, 'SELECT 1 AS n'));
      const [expectedOutputs, setExpectedOutputs] = useState([]);
      const [expectedOutputVisible, setExpectedOutputVisible] = useState(true);
      latest = solutions;
      expected = expectedOutputs;
      visible = expectedOutputVisible;
      return <TeacherSqlSolutions solutions={solutions} schema="CREATE TABLE T(id INT)"
        datasets={[{seedData:'seed A'}, {seedData:'seed B'}]} onChange={setSolutions}
        expectedOutputs={expectedOutputs} expectedOutputVisible={expectedOutputVisible}
        onExpectedOutputsChange={setExpectedOutputs} onExpectedOutputVisibilityChange={setExpectedOutputVisible}
        onRunningChange={runningChange} />;
    }
    export { act };
    export function mount(node) { const root = createRoot(node); root.render(<Harness/>); return root; }
    export function state() { return latest; }
    export function expectedState() { return expected; }
    export function outputVisible() { return visible; }
    export function change(node, value) { node.value = value; Simulate.change(node); }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "solution-ui-test", setup(builder) {
    builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
    builder.onLoad({ filter: /[\\/]teacherService\.ts$/ }, () => ({ contents: "export const teacherService = { validateSolution: (data) => globalThis.__solutionRun(data) };", loader: "js" }));
    builder.onLoad({ filter: /[\\/]LanguageContext\.tsx$/ }, () => ({ contents: "export const useLanguage = () => ({ locale:'en-US', t: (text, values={}) => text.replace(/\\{(\\w+)\\}/g, (_, key) => values[key] ?? '') });", loader: "js" }));
    builder.onLoad({ filter: /[\\/]TranslatedText\.tsx$/ }, () => ({ contents: "export function TranslatedText({children}) { return <>{children}</>; }", loader: "jsx" }));
    builder.onLoad({ filter: /[\\/]ProblemSqlEditor\.tsx$/ }, () => ({ contents: "export function ProblemSqlEditor({value,label,onChange}) { return <textarea aria-label={label} value={value} onChange={event=>onChange(event.target.value)} />; }", loader: "jsx" }));
  } }],
});
const filename = join(tmpdir(), `sqluit-solution-test-${process.pid}.cjs`);
let root, api;
try {
  await writeFile(filename, output.outputFiles[0].contents);
  api = require(filename);
  await api.act(async () => { root = api.mount(document.getElementById("root")); });
  assert.equal(document.querySelectorAll(".teacher-solution-card").length, 1);
  assert.ok(![...document.querySelectorAll("button")].some(button => button.textContent.includes("Add solution")));
  await api.act(async () => api.change(document.querySelector(".teacher-solution-filename input"), "answer"));
  assert.equal(api.state()[0].name, "answer.sql");
  await api.act(async () => api.change(document.querySelector(".teacher-solution-limit input"), "7000"));
  assert.equal(api.state()[0].timeLimitMs, 7000);
  const runButton = () => [...document.querySelectorAll("button")].find(button => button.textContent === "Run");
  await api.act(async () => document.querySelector("button[aria-pressed]").click());
  assert.equal(api.state()[0].enabled, false);
  assert.equal(runButton().disabled, true);
  await api.act(async () => document.querySelector("button[aria-pressed]").click());
  await api.act(async () => runButton().click());
  assert.deepEqual(calls.map(call => call.seedData), ["seed A", "seed B"]);
  assert.ok(calls.every(call => call.referenceSolution === "SELECT 1 AS n"));
  assert.equal(document.querySelectorAll(".teacher-solution-output").length, 2);
  assert.ok(document.querySelector(".teacher-solution-timing").textContent.includes("2.5 ms"));
  const addOutput = [...document.querySelectorAll("button")].find(button => button.textContent === "Add results to problem");
  assert.ok(addOutput);
  await api.act(async () => addOutput.click());
  assert.equal(api.expectedState().length, 2);
  assert.deepEqual(api.expectedState()[0], { name: "Result", columns: ["n"], rows: [[1]] });
  const hideOutput = [...document.querySelectorAll("button")].find(button => button.textContent === "Hide expected output");
  assert.ok(hideOutput);
  await api.act(async () => hideOutput.click());
  assert.equal(api.outputVisible(), false);
  assert.equal(document.querySelector("textarea").value, "SELECT 1 AS n");
  console.log("PASS: single solution, rename, disable, time limit, run outputs, add expected results, and hide toggle.");
} finally {
  if (root) await api.act(async () => root.unmount());
  await unlink(filename).catch(() => {});
  delete globalThis.__solutionRun;
  dom.window.close();
}
