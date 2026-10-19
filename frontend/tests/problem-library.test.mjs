import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Node']) globalThis[key] = dom.window[key];
HTMLElement.prototype.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__problems = [
  { id: 'a', number: '010', title: 'Ten', difficulty: 'Hard', createdAt: '2026-10-18T01:00:00', practiceListed: true },
  { id: 'b', number: '002', title: 'Two', difficulty: 'Easy', createdAt: null },
  { id: 'c', number: '001', title: 'One', difficulty: 'Medium', createdAt: '2026-10-17T01:00:00Z' },
];
const require = createRequire(import.meta.url);
const result = await build({
  stdin: { contents: `import React, { act } from 'react';
    import { createRoot } from 'react-dom/client';
    import { Simulate } from 'react-dom/test-utils';
    import { MemoryRouter } from 'react-router-dom';
    import { ProblemLibraryPage } from './src/pages/teacher/TeacherLandingPages';
    export { act };
    export function mount(node) { const root=createRoot(node); root.render(<MemoryRouter><ProblemLibraryPage/></MemoryRouter>); return root; }
    export function change(node,value) { node.value=value; Simulate.change(node); }
    export function check(node,checked) { node.checked=checked; Simulate.change(node); }`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent',
  loader: { '.css': 'empty' },
  plugins: [{ name: 'problem-library', setup(builder) {
    builder.onResolve({ filter: /^(react|react-dom|react-router-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
    builder.onLoad({ filter: /[\\/]teacherService\.ts$/ }, () => ({ contents: 'export const teacherService={getAllProblems:async()=>globalThis.__problems};', loader:'js' }));
    builder.onLoad({ filter: /[\\/]LanguageContext\.tsx$/ }, () => ({ contents: `export const useLanguage=()=>({locale:'vi-VN',t:(text,values={})=>text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'')});`, loader:'js' }));
    builder.onLoad({ filter: /[\\/]TranslatedText\.tsx$/ }, () => ({ contents: 'export function TranslatedText({children}) {return <>{children}</>;}', loader:'jsx' }));
    builder.onLoad({ filter: /[\\/]LanguageSwitch\.tsx$/ }, () => ({ contents: 'export function LanguageText({text}) {return <>{text}</>;}', loader:'jsx' }));
  }}],
});
const file = join(tmpdir(), `problem-library-${process.pid}.cjs`);
let root;
try {
  await writeFile(file,result.outputFiles[0].contents);
  const api=require(file);
  await api.act(async()=>{ root=api.mount(document.getElementById('root')); });
  const rows=()=>[...document.querySelectorAll('tbody tr')];
  const ids=()=>rows().map(row=>row.cells[0].textContent);
  const click=async(node)=>api.act(async()=>node.click());
  const button=(text)=>[...document.querySelectorAll('button')].find(node=>node.textContent===text);
  assert.equal(document.querySelectorAll('thead th').length,4);
  assert.equal(document.querySelectorAll('select').length,0);
  assert.equal(rows()[1].cells[3].textContent,'—');
  assert.match(rows()[0].cells[3].textContent,/18\/10\/2026/);
  await click(document.querySelector('[aria-label="Filter by ID"]'));
  assert.deepEqual(ids(),['001','002','010']);
  assert.equal(document.querySelector('[role="dialog"]').parentElement,document.body);
  await api.act(async()=>api.change(document.querySelector('[inputmode="numeric"]'),'0002'));
  assert.deepEqual(ids(),['002']);
  await click(button('Clear ID filter'));
  await api.act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(document.querySelector('[role="dialog"]'),null);
  await click(document.querySelector('[aria-label="Filter by difficulty"]'));
  await api.act(async()=>api.check(document.querySelectorAll('[type="checkbox"]')[0],true));
  assert.deepEqual(ids(),['002']);
  await api.act(async()=>api.check(document.querySelectorAll('[type="checkbox"]')[2],true));
  assert.deepEqual(ids(),['002','010']);
  await api.act(async()=>api.change(document.querySelector('[placeholder="Search problems…"]'),'Ten'));
  assert.deepEqual(ids(),['010']);
  await click(button('Clear difficulty filter'));
  assert.deepEqual(ids(),['010']);
  console.log('Problem library: date, numeric ID filter/sort, difficulty checkboxes, combined search and popover checks passed.');
  await api.act(async()=>root.unmount());
} finally { await unlink(file).catch(()=>{}); }
