import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/" });
for (const name of ["window", "document", "navigator", "HTMLElement", "MutationObserver", "localStorage"]) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.__workspaceApi = { getDraft: () => "", saveDraft() {}, getPreferences: async () => ({ favorites: [] }), getContests: async () => [] };

const output = await build({
  stdin: { contents: `
    export { createElement, act } from "react";
    export { createRoot } from "react-dom/client";
    export { MemoryRouter } from "react-router-dom";
    export { ProblemWorkspace } from "./src/pages/student/workspace/ProblemWorkspace";
    export { SqlWorkspace } from "./src/pages/student/workspace/SqlWorkspace";
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"development"', "import.meta.hot": "undefined" },
  plugins: [{ name: "workspace-test-adapters", setup(builder) {
    const stub = (filter, contents) => builder.onLoad({ filter }, () => ({ contents, loader: "tsx", resolveDir: process.cwd() }));
    stub(/components[\\/]AppHeader\.tsx$/, 'export const AppHeader = ({workspaceActions}) => <header>{workspaceActions}</header>;');
    stub(/context[\\/]AuthContext\.tsx$/, 'export const useAuth = () => ({session:{id:"student", name:"Student"}});');
    stub(/services[\\/]studentApi\.ts$/, 'export const studentApi = globalThis.__workspaceApi;');
    stub(/components[\\/]AiChatPanel\.tsx$/, 'export const AiChatPanel = () => null;');
    stub(/components[\\/]WorkspaceTools\.tsx$/, 'export const WorkspaceTools = () => null;');
    stub(/@uiw[\\/]react-codemirror[\\/].*index\.js$/, 'export default function CodeMirror({value,onChange,...props}) { return <textarea aria-label={props["aria-label"]} value={value} onInput={e=>onChange(e.currentTarget.value)} />; }');
  }}],
});
const filename = join(tmpdir(), `sqluit-workspace-flow-${process.pid}.cjs`);
await writeFile(filename, output.outputFiles[0].contents);
try {
  const { createElement: h, act, createRoot, MemoryRouter, ProblemWorkspace, SqlWorkspace } = createRequire(import.meta.url)(filename);
  const root = createRoot(document.getElementById("root"));
  const problem = { id:"p1", number:"1", title:"Customer directory", workspaceParts:["DDL","DML","SQL"], description:"Find customers", requirements:"Return names", tables:[], draft:"", topic:"SELECT", difficulty:"Easy", progress:"Not started", hint:"" };
  const schemaTables = [{name:"Customers",columns:[{name:"id",type:"int",constraints:"NOT NULL"}],primaryKeys:["id"],foreignKeys:[],constraints:[]}];
  const success = {status:"Success",message:"Executed successfully",schemaTables,executionTimeMs:4.25};
  let complete;
  globalThis.__workspaceApi.runWorkspace = () => new Promise(resolve => { complete = resolve; });
  const stage = () => document.querySelector('.problem-workspace-stage:not([hidden])');
  const nav = part => [...document.querySelectorAll('header nav button')].find(button=>button.querySelector('b')?.textContent===part);
  const click = async button => { assert.ok(button, "Button must exist"); assert.equal(button.disabled,false); await act(async()=>button.click()); };
  const edit = async value => { await act(async()=>{ const input=stage().querySelector('textarea'); input.value=value; input.dispatchEvent(new dom.window.Event('input',{bubbles:true})); }); };
  const confirm = () => stage().querySelector('.stage-run-actions button:last-child');
  const run = () => click(stage().querySelector('.stage-run-actions .primary'));
  await act(async()=>root.render(h(MemoryRouter, null, h(ProblemWorkspace,{problem}))));
  assert.equal(nav('DML').disabled,true);
  assert.equal(nav('SQL').disabled,true);
  await edit('CREATE TABLE Customers(id INT PRIMARY KEY)');
  await run();
  assert.equal(confirm().disabled,true);
  await act(async()=>complete({...success,tables:[]}));
  assert.ok(stage().querySelector('.teacher-schema-diagram-panel'));
  assert.ok(stage().querySelector('.teacher-schema-diagram-action'), "Diagram must offer fullscreen");
  assert.equal(document.querySelector('.stage-output'),null,"There must be no bottom result pane");
  await edit('CREATE TABLE Customers(id INT PRIMARY KEY, name NVARCHAR(50))');
  assert.equal(confirm().disabled,true,"Editing after success must invalidate confirmation");
  await run();
  await act(async()=>complete({...success,tables:[]}));
  await click(confirm());
  assert.equal(stage().id,'workspace-stage-DML');
  assert.equal(nav('DML').disabled,false);
  await edit('INSERT INTO Customers(id) VALUES(1)');
  await run();
  await act(async()=>complete({...success,tables:[{name:'Customers',columns:['id'],rows:[[1]]}]}));
  const database=stage().querySelector('.workspace-database-content');
  assert.ok(database.querySelector('.teacher-schema-diagram-panel'));
  assert.ok(database.querySelector('.workspace-database-table'));
  assert.equal(database.querySelector('.workspace-execution-feedback'), null, "Successful execution must not add a banner above the diagram");
  assert.equal(database.querySelectorAll('.teacher-schema-diagram-action').length, 1, "The workspace diagram must offer fullscreen only");
  assert.ok(stage().querySelector('.stage-editor-actions').textContent.includes('4.25 ms'));
  await click(nav('DDL'));
  await edit('CREATE TABLE Customers(id INT)');
  assert.equal(nav('DML').disabled,true,"Changing confirmed DDL must lock later stages again");
  await run();
  await act(async()=>complete({status:'Error',message:"('42S02', \"[42S02] [Microsoft][ODBC Driver 17 for SQL Server][SQL Server]Invalid object name 'w_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.Authors'. (208) (SQLExecDirectW)\")",executionTimeMs:1.5}));
  assert.equal(confirm().disabled,true);
  assert.ok(stage().querySelector('[role="alert"]').textContent.includes('Không tìm thấy bảng Authors'));
  assert.ok(!stage().querySelector('[role="alert"]').textContent.includes('ODBC'));
  assert.ok(!stage().querySelector('[role="alert"]').textContent.includes('w_aaaaaaaa'));

  await act(async()=>root.render(h(MemoryRouter,null,h(SqlWorkspace,{problem:{...problem,workspaceParts:['SQL']}}))));
  globalThis.__workspaceApi.runQuery = async()=>({...success,table:{name:'Result',columns:['id'],rows:[[1]]}});
  globalThis.__workspaceApi.submitSolution = async()=>({...success,status:'Accepted',message:'All tests passed'});
  await click(document.querySelectorAll('.editor-actions button')[1]);
  assert.equal(document.querySelector('#workspace-result-pane'),null,"SQL must not mount a bottom result panel");
  assert.ok(document.querySelector('.workspace-submission-content'));
  assert.equal(document.querySelector('.workspace-submission-content a'),null,"Submission must not include a history link");
  assert.equal(document.querySelectorAll('.workspace-attempt').length,1);
  assert.ok(document.querySelector('.workspace-attempt').textContent.includes('4.25 ms'));
  await click(document.querySelector('.editor-actions .primary'));
  assert.equal(document.querySelectorAll('.workspace-attempt').length,2,"Runs and submissions must share one history");
  await act(async()=>root.unmount());
  console.log('PASS: DDL confirmation and invalidation, confirm-to-DML, shared diagram/data, Submission history and timing.');
} finally { await unlink(filename); dom.window.close(); }
// Browser-oriented dependencies keep background handles open in this isolated DOM process.
process.exit(0);
