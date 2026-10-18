import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/workspace/P?source=Contests&context=A" });
for (const name of ["window", "document", "navigator", "HTMLElement", "MutationObserver", "localStorage", "location"]) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__examState = { examMode:true, status:"not_started", problemIds:["P","Q"], violationCount:0, drafts:{} };
globalThis.__examRequests = [];
globalThis.__examApi = async (url, options={}) => {
  const state=globalThis.__examState;
  const body=options.body ? JSON.parse(options.body) : {};
  globalThis.__examRequests.push({url,body});
  if (url.endsWith('/start')) state.status='active';
  if (body.problemId && state.status==='active') state.drafts[body.problemId]={ddl:body.ddl,dml:body.dml,query:body.query};
  if (url.endsWith('/violation') && state.status==='active') { state.violationCount++; if(state.violationCount===2) {state.status='submitted';state.finishReason='violations';} }
  if (url.endsWith('/submit')) {state.status='submitted';state.finishReason='student';}
  return structuredClone(state);
};
const output=await build({
  stdin:{contents:`
    import {WorkspaceExamProvider,useWorkspaceExam,WorkspaceExamFinishButton} from './src/pages/student/workspace/components/WorkspaceExamContext';
    import {useParams} from 'react-router-dom';
    export {createMemoryRouter,RouterProvider} from 'react-router-dom';
    export {createRoot} from 'react-dom/client';
    export {act,createElement} from 'react';
    function Content(){const exam=useWorkspaceExam();const {id}=useParams();return <div><WorkspaceExamFinishButton/><button id="edit" onClick={()=>exam.update(id,{ddl:'CREATE TABLE '+id+'(id INT)'})}>Edit</button><a href="/dashboard" id="leave">Leave</a><span id="id">{id}</span></div>}
    export function Page(){return <WorkspaceExamProvider><Content/></WorkspaceExamProvider>}
  `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},
  plugins:[{name:'exam-adapters',setup(b){
    const stub=(filter,contents)=>b.onLoad({filter},()=>({contents,loader:'tsx',resolveDir:process.cwd()}));
    stub(/services[\\/]apiClient\.ts$/,'export const apiFetch = globalThis.__examApi;');
    stub(/context[\\/]AuthContext\.tsx$/,'export const useAuth=()=>({session:{id:"S",role:"student"}});');
    stub(/context[\\/]LanguageContext\.tsx$/,'const t=s=>s;export const useLanguage=()=>({t});');
    stub(/components[\\/]ui\.tsx$/,'export const Loading=()=> <p>Loading</p>;export const Dialog=({children,title,onClose})=><section role="dialog"><h2>{title}</h2>{children}</section>;');
  }}]
});
const filename=join(tmpdir(),`sqluit-exam-${process.pid}.cjs`);
await writeFile(filename,output.outputFiles[0].contents);
try {
  const {act,createElement:h,createRoot,createMemoryRouter,RouterProvider,Page}=createRequire(import.meta.url)(filename);
  const root=createRoot(document.getElementById('root'));
  const entry='/workspace/P?source=Contests&context=A';
  const router=createMemoryRouter([{path:'/workspace/:id',element:h(Page)},{path:'/dashboard',element:h('p',null,'Dashboard')}],{initialEntries:[entry]});
  const click=async button=>{assert.ok(button);await act(async()=>{button.click();await new Promise(r=>setTimeout(r,0));});};
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  await act(async()=>root.render(h(RouterProvider,{router})));
  assert.ok(button('Start exam'));
  assert.equal(document.querySelector('#edit'),null,'Editing is gated until the student accepts exam rules');
  await click(button('Start exam'));
  await click(document.querySelector('#edit'));
  await act(async()=>router.navigate('/workspace/Q?source=Contests&context=A'));
  assert.equal(document.querySelector('#id').textContent,'Q','Switching within an activity must stay allowed');
  assert.equal(globalThis.__examState.violationCount,0);
  await click(document.querySelector('#edit'));
  await act(async()=>{
    window.dispatchEvent(new dom.window.Event('blur'));
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    await new Promise(r=>setTimeout(r,0));
  });
  assert.equal(globalThis.__examRequests.filter(r=>r.url.endsWith('/violation')).length,1,'blur and visibilitychange describe one focus-loss episode');
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes('Exam warning'));
  await click(button('Continue exam'));
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));
  const copy=new dom.window.Event('copy',{bubbles:true});Object.defineProperty(copy,'clipboardData',{value:{getData:()=> 'SELECT 1'}});
  await act(async()=>document.dispatchEvent(copy));
  const localPaste=new dom.window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(localPaste,'clipboardData',{value:{getData:()=> 'SELECT 1'}});
  await act(async()=>document.dispatchEvent(localPaste));
  assert.equal(localPaste.defaultPrevented,false,'Copy/paste inside the workspace stays allowed');
  const externalPaste=new dom.window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(externalPaste,'clipboardData',{value:{getData:()=> 'outside content'}});
  await act(async()=>{document.dispatchEvent(externalPaste);await new Promise(r=>setTimeout(r,0));});
  assert.equal(externalPaste.defaultPrevented,true);
  assert.ok(document.body.textContent.includes('Exam submitted'));
  assert.ok(globalThis.__examState.drafts.P.ddl.includes('TABLE P'),'The previous problem must be saved before automatic submission');
  assert.ok(globalThis.__examState.drafts.Q.ddl.includes('TABLE Q'));

  // Start another mount with a clean server attempt, then exercise navigation blocking.
  await act(async()=>root.unmount());
  localStorage.clear();
  globalThis.__examState={examMode:true,status:'active',problemIds:['P','Q'],violationCount:0,drafts:{}};
  const root2=createRoot(document.getElementById('root'));
  const router2=createMemoryRouter([{path:'/workspace/:id',element:h(Page)},{path:'/dashboard',element:h('p',null,'Dashboard')},{path:'/contests/A',element:h('p',null,'Contest overview')}],{initialEntries:[entry]});
  await act(async()=>root2.render(h(RouterProvider,{router:router2})));
  await act(async()=>{await router2.navigate('/dashboard');await new Promise(r=>setTimeout(r,0));});
  assert.equal(router2.state.location.pathname,'/workspace/P');
  assert.equal(globalThis.__examState.violationCount,1,'Browser back/programmatic navigation is blocked and warned');
  await click(button('Continue exam'));
  await click(button('Submit & Exit'));
  await click([...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Submit & Exit'));
  assert.equal(router2.state.location.pathname,'/contests/A','Submit & Exit must leave only after the server confirms submission');
  assert.equal(globalThis.__examState.finishReason,'student');
  await act(async()=>root2.unmount());
  console.log('PASS: exam start gate, internal navigation, focus deduplication, paste policy, all-problem autosubmit and manual submit.');
} finally {await unlink(filename);dom.window.close();}
process.exit(0);
