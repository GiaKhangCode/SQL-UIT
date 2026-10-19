import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "Element", "Node", "localStorage", "getComputedStyle"]) globalThis[key] = dom.window[key];
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
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
    import { ProblemEditorPage } from './src/pages/teacher/ProblemEditorPage';
    import { MemoryRouter } from 'react-router-dom';
    let latest;
    let expected;
    let visible;
    const runningChange = () => {};
    function Harness() {
      const [solutions, setSolutions] = useState(() => initialSqlSolutions(undefined, 'SELECT 1 AS n'));
      const [expectedOutputs, setExpectedOutputs] = useState([]);
      const [expectedOutputVisible, setExpectedOutputVisible] = useState(true);
      const [datasets, setDatasets] = useState([{seedData:'seed A'}, {seedData:'seed B'}]);
      latest = solutions;
      expected = expectedOutputs;
      visible = expectedOutputVisible;
      return <TeacherSqlSolutions solutions={solutions} schema="CREATE TABLE T(id INT)"
        datasets={datasets} onChange={setSolutions}
        expectedOutputs={expectedOutputs} expectedOutputVisible={expectedOutputVisible}
        onExpectedOutputsChange={setExpectedOutputs} onExpectedOutputVisibilityChange={setExpectedOutputVisible}
        onDatasetVisibilityChange={(index, isHidden) => setDatasets(current => current.map((dataset, i) => i === index ? {...dataset,isHidden} : dataset))}
        onRunningChange={runningChange} />;
    }
    export { act };
    export function mount(node) { const root = createRoot(node); root.render(<Harness/>); return root; }
    export function showEditor(root) { root.render(<MemoryRouter initialEntries={['/teacher/problems/new']}><ProblemEditorPage /></MemoryRouter>); }
    export function state() { return latest; }
    export function expectedState() { return expected; }
    export function outputVisible() { return visible; }
    export function change(node, value) { node.value = value; Simulate.change(node); }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  loader: { ".css": "empty" },
  plugins: [{ name: "solution-ui-test", setup(builder) {
    builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
    builder.onLoad({ filter: /[\\/]teacherService\.ts$/ }, () => ({ contents: "export const teacherService = { getAllProblems: async () => [], validateSolution: (data) => globalThis.__solutionRun(data) };", loader: "js" }));
    builder.onLoad({ filter: /[\\/]LanguageContext\.tsx$/ }, () => ({ contents: "export const useLanguage = () => ({ locale:'en-US', t: (text, values={}) => typeof text === 'string' ? text.replace(/\\{(\\w+)\\}/g, (_, key) => values[key] ?? '') : text });", loader: "js" }));
    builder.onLoad({ filter: /[\\/]TranslatedText\.tsx$/ }, () => ({ contents: "export function TranslatedText({children}) { return <>{children}</>; }", loader: "jsx" }));
    builder.onLoad({ filter: /[\\/]ProblemSqlEditor\.tsx$/ }, () => ({ contents: "export function ProblemSqlEditor({value,label,onChange}) { return <textarea aria-label={label} value={value} onChange={event=>onChange(event.target.value)} />; }", loader: "jsx" }));
    builder.onLoad({ filter: /[\\/]ProblemRichTextEditor\.tsx$/ }, () => ({ contents: "export function ProblemRichTextEditor({value,label,onChange}) { return <textarea aria-label={label} value={value} onChange={event=>onChange(event.target.value)} />; }", loader: "jsx" }));
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
  assert.ok(![...document.querySelectorAll("button")].some(button => button.textContent === "Add results to problem"));
  assert.equal(api.expectedState().length, 2);
  assert.deepEqual(api.expectedState()[0], { name: "Result", columns: ["n"], rows: [[1]] });
  const hideOutput = [...document.querySelectorAll("button")].find(button => button.textContent === "Hide expected output");
  assert.ok(hideOutput);
  await api.act(async () => hideOutput.click());
  assert.equal(api.outputVisible(), false);
  await api.act(async () => runButton().click());
  assert.equal(api.outputVisible(), false, "Rerunning must preserve the instructor's hidden-output setting");
  assert.equal(document.querySelector("textarea").value, "SELECT 1 AS n");
  const savedOutputs = api.expectedState();
  globalThis.__solutionRun = async payload => payload.seedData === "seed B"
    ? { status: "Error", message: "Invalid SQL" }
    : { status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } };
  await api.act(async () => runButton().click());
  assert.deepEqual(api.expectedState(), savedOutputs, "A failed dataset must not publish a partial answer set");
  let complete;
  globalThis.__solutionRun = () => new Promise(resolve => { complete = resolve; });
  await api.act(async () => runButton().click());
  await api.act(async () => api.change(document.querySelector("textarea"), "SELECT 3 AS n"));
  await api.act(async () => complete({ status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } }));
  await api.act(async () => complete({ status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } }));
  assert.deepEqual(api.expectedState(), savedOutputs, "Results from an edited query must not replace the expected output");

  // Use the actual New problem page and Preview button, without saving the draft.
  let value = 7;
  globalThis.__solutionRun = async () => ({ status: "Success", executionTimeMs: 1,
    table: { name: "Result", columns: ["n"], rows: [[value]] } });
  await api.act(async () => api.showEditor(root));
  await api.act(async () => document.querySelector('.teacher-problem-preview-action').click());
  const preview = () => document.querySelector('.teacher-student-preview-content');
  assert.ok(preview());
  assert.equal(preview().querySelector('.problem-expected-output'), null);
  await api.act(async () => document.querySelector('[aria-controls="database-panel-solution"]').click());
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Solution 1 SQL"]'), "SELECT 7 AS n"));
  await api.act(async () => runButton().click());
  assert.equal(preview().querySelector('.problem-expected-output h3').textContent, "Expected output");
  assert.equal(preview().querySelector('.problem-expected-output td').textContent, "7");
  assert.ok(preview().lastElementChild.classList.contains('problem-expected-output'), "Expected output must appear at the end of the prompt");
  assert.ok(!preview().textContent.includes("SELECT 7"), "Preview shows the output table rather than the reference query");
  assert.ok(document.querySelector('.teacher-problem-content-section .problem-expected-output'));
  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Hide expected output').click());
  assert.equal(preview().querySelector('.problem-expected-output'), null);
  value = 9;
  await api.act(async () => runButton().click());
  assert.equal(preview().querySelector('.problem-expected-output'), null, "A rerun must not reveal a hidden answer");
  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Show expected output').click());
  assert.equal(preview().querySelector('.problem-expected-output td').textContent, "9");
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Solution 1 SQL"]'), "SELECT 10 AS n"));
  assert.equal(preview().querySelector('.problem-expected-output'), null, "Editing SQL must invalidate the previous expected output");

  await api.act(async () => document.querySelector('[aria-controls="database-panel-datasets"]').click());
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Test dataset 1 SQL"]'), "INSERT INTO T (id) VALUES (100);"));
  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Add dataset').click());
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Test dataset 2 SQL"]'), "INSERT INTO T (id) VALUES (900);"));
  await api.act(async () => document.querySelector('[aria-controls="database-panel-solution"]').click());
  await api.act(async () => runButton().click());
  assert.equal(preview().querySelectorAll('.problem-expected-sample').length, 1, 'An added hidden dataset must not appear in Preview');
  const datasetToggle = index => document.querySelectorAll('.teacher-result-hidden-toggle')[index];
  assert.equal(datasetToggle(1).getAttribute('aria-pressed'), 'true');
  await api.act(async () => datasetToggle(1).click());
  assert.equal(preview().querySelectorAll('.problem-expected-sample').length, 2, 'Showing another dataset must update Preview immediately without rerunning');
  await api.act(async () => datasetToggle(0).click());
  assert.equal(preview().querySelectorAll('.problem-expected-sample').length, 1);
  assert.equal(preview().querySelector('.problem-expected-sample h4').textContent, 'Dataset 2', 'The remaining output must retain its original dataset number');
  await api.act(async () => [...document.querySelectorAll('.teacher-preview-tabs button')].find(button => button.textContent === 'Database').click());
  assert.ok(preview().textContent.includes('900'), 'Database Preview must use the visible dataset');
  assert.ok(!preview().textContent.includes('100'), 'Database Preview must not contain hidden seed data');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-datasets"]').click());
  assert.equal(document.querySelector('.teacher-dataset-hidden-toggle').getAttribute('aria-pressed'), 'true', 'Query-result visibility must stay in sync with the dataset tab');
  console.log("PASS: automatic expected output, failed/stale-run protection, live Preview, and per-dataset hiding of seed data and output.");
} finally {
  if (root) await api.act(async () => root.unmount());
  await unlink(filename).catch(() => {});
  delete globalThis.__solutionRun;
  dom.window.close();
}
