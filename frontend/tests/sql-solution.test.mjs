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
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
    export function showEditor(root) { root.render(<MemoryRouter initialEntries={['/teacher/problems/new']}><Routes><Route path='/teacher/problems/new' element={<ProblemEditorPage />} /><Route path='/teacher/problems/:problemId/edit' element={<ProblemEditorPage />} /></Routes></MemoryRouter>); }
    export function state() { return latest; }
    export function expectedState() { return expected; }
    export function outputVisible() { return visible; }
    export function change(node, value) { node.value = value; Simulate.change(node); }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
  loader: { ".css": "empty" },
  plugins: [{ name: "solution-ui-test", setup(builder) {
    builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
    builder.onLoad({ filter: /[\\/]teacherService\.ts$/ }, () => ({ contents: "export const teacherService = { getAllProblems: async () => [], getProblem: async () => structuredClone(globalThis.__savedProblem), createProblem: async payload => { globalThis.__savedPayload = structuredClone(payload); globalThis.__savedProblem = { ...payload, id: 'saved-problem', description: payload.statement, databaseType: payload.database, practiceListed: payload.visibility === 'Public', testCases: payload.testCases.map(tc => ({ ...tc, schema: payload.schema })) }; return structuredClone(globalThis.__savedProblem); }, updateProblem: async (id, payload) => { globalThis.__savedPayload = structuredClone(payload); }, validateSolution: (data) => globalThis.__solutionRun(data) };", loader: "js" }));
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
  assert.ok([...document.querySelectorAll("button")].some(button => button.textContent.includes("Add solution")));
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
  assert.equal(document.querySelector('textarea[aria-label="Solution 1 SQL"]').value, "SELECT 1 AS n");
  const savedOutputs = api.expectedState();
  globalThis.__solutionRun = async payload => payload.seedData === "seed B"
    ? { status: "Error", message: "Invalid SQL" }
    : { status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } };
  await api.act(async () => runButton().click());
  assert.deepEqual(api.expectedState(), savedOutputs, "A failed dataset must not publish a partial answer set");
  let complete;
  globalThis.__solutionRun = () => new Promise(resolve => { complete = resolve; });
  await api.act(async () => runButton().click());
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Solution 1 SQL"]'), "SELECT 3 AS n"));
  await api.act(async () => complete({ status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } }));
  await api.act(async () => complete({ status: "Success", table: { name: "Result", columns: ["n"], rows: [[2]] } }));
  assert.deepEqual(api.expectedState(), savedOutputs, "Results from an edited query must not replace the expected output");

  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Add solution')).click());
  assert.equal(api.state().length, 2);
  assert.equal(api.state()[1].name, 'solution_2.sql');
  const descriptions = document.querySelectorAll('.teacher-solution-description textarea');
  await api.act(async () => api.change(descriptions[1], 'List products from China.'));
  assert.equal(api.state()[1].description, 'List products from China.');
  assert.notEqual(api.state()[0].id, api.state()[1].id);

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
  assert.equal(preview().querySelectorAll('.problem-expected-sample').length, 2, 'Source datasets are visible by default; activity settings control dataset visibility');
  assert.equal(document.querySelector('.teacher-result-hidden-toggle'), null, 'Dataset hide controls belong to activity Data Import settings');
  await api.act(async () => [...document.querySelectorAll('.teacher-preview-tabs button')].find(button => button.textContent === 'Database').click());
  assert.ok(preview().textContent.includes('100'), 'Source Preview uses the first visible dataset');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-datasets"]').click());
  assert.equal(document.querySelector('.teacher-dataset-hidden-toggle'), null, 'Source Data Import has no dataset visibility buttons');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-solution"]').click());
  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Add solution')).click());
  await api.act(async () => api.change(document.querySelectorAll('.teacher-solution-description textarea')[1], 'Count all products.'));
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Solution 2 SQL"]'), 'SELECT 42 AS n'));
  globalThis.__solutionRun = async () => ({ status:'Success', executionTimeMs:1, table:{name:'Result',columns:['n'],rows:[[42]]} });
  await api.act(async () => [...document.querySelectorAll('.teacher-solution-card')][1].querySelector('.teacher-solution-run-row .primary').click());
  await api.act(async () => [...document.querySelectorAll('.teacher-preview-tabs button')].find(button => button.textContent === 'Description').click());
  const questionSelect = preview().querySelector('.workspace-question-picker select');
  const firstId = questionSelect.options[0].value;
  const secondId = questionSelect.options[1].value;
  await api.act(async () => api.change(questionSelect, secondId));
  assert.ok(preview().textContent.includes('Count all products.'));
  assert.equal(preview().querySelector('.problem-expected-output td').textContent,'42');
  await api.act(async () => api.change(questionSelect, firstId));
  assert.equal(preview().querySelector('.problem-expected-output td').textContent,'9','Running the second question must preserve the first output');
  // Check Table Design and save the actual New problem form into Edit.
  await api.act(async () => document.querySelector('[aria-controls="database-panel-schema"]').click());
  await api.act(async () => api.change(document.querySelector('textarea[aria-label="Database structure SQL"]'), 'CREATE TABLE T (id INT PRIMARY KEY);'));
  const relationInputs = document.querySelectorAll('.database-description-row input, .database-description-row textarea');
  await api.act(async () => api.change(relationInputs[0], 'T'));
  await api.act(async () => api.change(relationInputs[1], 'id'));
  await api.act(async () => api.change(relationInputs[2], 'Stores identifiers.'));
  await api.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Run table').click());
  assert.ok(document.querySelector('.teacher-schema-diagram-panel'), 'Table Design previews the schema');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-solution"]').click());
  await api.act(async () => document.querySelectorAll('.teacher-solution-card')[1].querySelector('.teacher-solution-run-row .primary').click());
  await api.act(async () => document.querySelector('[aria-controls="database-panel-datasets"]').click());
  await api.act(async () => api.change(document.querySelector('input[aria-label="Dataset 1 file name"]'), 'students_seed'));
  await api.act(async () => api.change(document.querySelectorAll('#basic-information input')[1], 'Saved flow test'));
  await api.act(async () => document.querySelector('.teacher-problem-save-exit-actions .primary').click());
  assert.equal(globalThis.__savedPayload.databaseDescription[0].predicate, 'Stores identifiers.');
  assert.equal(globalThis.__savedPayload.testCases.length, 2);
  assert.equal(globalThis.__savedPayload.sqlSolutions.length, 2);
  assert.equal(globalThis.__savedPayload.sqlSolutions[1].expectedOutputs[0].rows[0][0], 42);
  assert.equal(localStorage.getItem('teacher-dataset-names:new'), null, 'Saved dataset names must not leak to the next New problem');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-datasets"]').click());
  assert.equal(document.querySelector('input[aria-label="Dataset 1 file name"]').value, 'students_seed', 'Dataset names must survive New to Edit navigation');
  await api.act(async () => document.querySelector('[aria-controls="database-panel-solution"]').click());
  assert.equal(document.querySelectorAll('.teacher-solution-description textarea')[1].value, 'Count all products.', 'Question descriptions restore in Edit');
  assert.equal(document.querySelector('textarea[aria-label="Solution 2 SQL"]').value, 'SELECT 42 AS n');
  console.log("PASS: automatic expected output, failed/stale-run protection, live Preview, and dataset visibility controls moved to activity settings.");
} finally {
  if (root) await api.act(async () => root.unmount());
  await unlink(filename).catch(() => {});
  delete globalThis.__solutionRun;
  dom.window.close();
}
