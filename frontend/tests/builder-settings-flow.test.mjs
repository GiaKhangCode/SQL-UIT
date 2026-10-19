import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const name of ['window','document','navigator','HTMLElement','Element','HTMLDialogElement','localStorage','DOMParser','Node']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
HTMLElement.prototype.scrollIntoView = () => {};
HTMLDialogElement.prototype.showModal = function() { this.open = true; };
HTMLDialogElement.prototype.close = function() { this.open = false; };
const summaries = ['p1','p2','p3'].map((id, index) => ({ id, title: `Exercise ${index + 1}`, number: String(index + 1), difficulty: 'Easy', topics: ['SELECT'] }));
globalThis.__builderState = {
  activity: { title: 'Settings review', classIds: [], audienceType: 'all_students', shortDescription: 'Review', description: 'Review', rules: '', published: false,
    opens: null, closes: null, studentOptions: {}, problemList: summaries.slice(0,2).map(p => ({ id: p.id, points: 10, workspaceParts: ['DDL','DML','SQL'], databaseStructureVisible: true, databaseDescriptionVisible: true, datasetVisibility: {} })) },
  summaries, saves: [],
};
const output = await build({
  stdin: { contents: `export { createElement, act } from "react"; export { createRoot } from "react-dom/client"; export { MemoryRouter, Routes, Route } from "react-router-dom"; export { ContestBuilderPage } from "./src/pages/teacher/BuilderPages";`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.hot': 'undefined', 'import.meta.env.VITE_API_URL': '""' },
  plugins: [{ name: 'mock-teacher', setup(build) {
    build.onResolve({ filter: /services\/teacherService$/ }, () => ({ path: 'teacher', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const teacherService = {
      getClasses: async () => [], getAllProblems: async () => globalThis.__builderState.summaries,
      getAudienceCount: async () => ({ eligibleStudents: 5 }),
      getAssignment: async () => structuredClone(globalThis.__builderState.activity),
      getProblem: async id => ({ id, description: 'Statement ' + id, schema: 'CREATE TABLE T (Id INT)', databaseDescription: [{ tableName: 'Table ' + id, attributes: 'Id', predicate: 'Records ' + id }], testCases: [{seedData:'INSERT INTO T (Id) VALUES (1)',isHidden:false}], sqlSolutions: [] }),
      updateAssignment: async (id, payload) => { globalThis.__builderState.saves.push(structuredClone(payload)); globalThis.__builderState.activity = {...payload, problemList: structuredClone(payload.problems)}; }
    };` }));
  } }],
});
const filename = join(tmpdir(), `sqluit-builder-flow-${process.pid}.cjs`);
try {
  await writeFile(filename, output.outputFiles[0].contents);
  const { createElement: h, act, createRoot, MemoryRouter, Routes, Route, ContestBuilderPage } = createRequire(import.meta.url)(filename);
  let root;
  const mount = async () => { root = createRoot(document.getElementById('root')); await act(async () => root.render(h(MemoryRouter, { initialEntries: ['/teacher/contests/a/edit'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, h(Routes, null, h(Route, { path: '/teacher/contests/:id/edit', element: h(ContestBuilderPage) }))))); };
  const click = async element => { assert.ok(element, 'Expected control exists'); await act(async () => element.click()); };
  const settings = index => document.querySelectorAll('.builder-problem-settings-button')[index];
  const sectionToggle = part => document.querySelector(`#builder-settings-${part}`)?.closest('.builder-settings-section').querySelector('input');
  const openQuery = () => click(document.querySelector('[aria-controls="builder-settings-SQL"]'));
  const hideButtons = () => [...document.querySelectorAll('.builder-settings-visibility button')];
  const save = () => click(document.querySelector('.teacher-contest-save-exit-actions .primary'));
  await mount();
  await click(settings(0));
  await openQuery();
  await click(hideButtons()[0]); await click(hideButtons()[1]);
  await click(sectionToggle('DDL'));
  await click(document.querySelector('#builder-settings-DML .builder-settings-dataset-heading button'));
  await click(settings(1)); await openQuery();
  assert.deepEqual(hideButtons().map(b => b.getAttribute('aria-pressed')), ['false','false'], 'Problem 2 settings must be independent');
  assert.equal(sectionToggle('DDL').checked, true);
  await click(settings(0)); await openQuery();
  assert.deepEqual(hideButtons().map(b => b.getAttribute('aria-pressed')), ['true','true']);
  assert.equal(sectionToggle('DDL').checked, false);
  await save();
  const saved = globalThis.__builderState.saves.at(-1);
  assert.deepEqual(saved.problems[0].workspaceParts, ['DML','SQL']);
  assert.equal(saved.problems[0].databaseStructureVisible, false);
  assert.equal(saved.problems[0].databaseDescriptionVisible, false);
  assert.deepEqual(saved.problems[0].datasetVisibility, { '1': false });
  assert.equal(saved.problems[1].databaseStructureVisible, true);
  await act(async () => root.unmount()); await mount();
  await click(settings(0)); await openQuery();
  assert.deepEqual(hideButtons().map(b => b.getAttribute('aria-pressed')), ['true','true'], 'Saved visibility must restore after reopening the page');
  assert.equal(sectionToggle('DDL').checked, false);
  await click(document.querySelector('.builder-problem-settings-footer button'));
  await click(document.querySelector('.teacher-builder-problems > button'));
  await click(document.querySelector('.teacher-add-problem-list .teacher-small-button'));
  await openQuery(); await click(hideButtons()[1]); await click(sectionToggle('DML'));
  await click(document.querySelector('.builder-problem-settings-footer button'));
  assert.equal(document.querySelectorAll('.builder-problem-settings-button').length, 3);
  await save();
  const added = globalThis.__builderState.saves.at(-1).problems[2];
  assert.equal(added.id, 'p3'); assert.equal(added.databaseDescriptionVisible, false);
  assert.deepEqual(added.workspaceParts, ['DDL','SQL']);
  await act(async () => root.unmount());
  console.log('PASS: per-problem isolation, switching, save/reopen, dataset settings and library configuration before adding.');
} finally { await unlink(filename); dom.window.close(); }
process.exit(0);
