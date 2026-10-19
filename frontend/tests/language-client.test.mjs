import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "Node", "MouseEvent"]) globalThis[key] = dom.window[key];
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__sqluitTestHot = { data: {} };
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
HTMLElement.prototype.getBoundingClientRect = () => ({ top: 20, left: 20, bottom: 40, right: 120, width: 100, height: 20 });
HTMLElement.prototype.animate = () => ({ cancel() {} });
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(node) { this.callback([{ target: node, isIntersecting: true }]); }
  unobserve() {}
  disconnect() {}
};
const output = await build({
  stdin: { contents: `
    import React, { act } from 'react';
    import { createRoot } from 'react-dom/client';
    import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
    import { AppearanceSettings } from './src/components/AppearanceSettings';
    import { WorkspaceNavigation } from './src/pages/student/workspace/components/WorkspaceNavigation';
    import { LanguageText } from './src/components/LanguageSwitch';
    import { TranslatedText } from './src/components/TranslatedText';
    import { createStableContext } from './src/context/stableContext';
    const originalContext = createStableContext('sqluit.language', null);
    const CachedConsumer = React.memo(function CachedConsumer() {
      const state = React.useContext(originalContext);
      return <span id="cached-language">{state.language}</span>;
    });
    function Probe() {
      const { t: teacher, language } = useLanguage('teacher');
      const { t: common } = useLanguage();
      return <section id="probe" data-language={language}><TranslatedText>{teacher('Practice sections')}</TranslatedText><TranslatedText>{common('Log out')}</TranslatedText></section>;
    }
    export { act };
    export function refreshContext(factory) { return factory('sqluit.language', null) === originalContext; }
    export function mount(node) {
      const root = createRoot(node);
      root.render(<LanguageProvider><AppearanceSettings /><LanguageText text="Problems" /><WorkspaceNavigation parts={['DDL','DML','SQL']} active="DDL" onChange={() => {}} /><Probe /><CachedConsumer /><input id="draft" defaultValue="SELECT * FROM Customers" /></LanguageProvider>);
      return root;
    }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
  define: { "import.meta.hot": "globalThis.__sqluitTestHot" },
  plugins: [{ name: "native-react", setup(builder) {
    const require = createRequire(import.meta.url);
    builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
  } }],
});
const filename = join(tmpdir(), `sqluit-language-client-${process.pid}.cjs`);
const refreshFilename = join(tmpdir(), `sqluit-context-refresh-${process.pid}.cjs`);
let root, api;
try {
  await writeFile(filename, output.outputFiles[0].contents);
  api = createRequire(import.meta.url)(filename);
  await api.act(async () => { root = api.mount(document.getElementById("root")); });
  assert.equal(document.getElementById("probe").textContent, "Các phần luyện tậpĐăng xuất");
  // Evaluate a new module copy, as Vite does during a hot update, against the
  // same hot.data object. Existing memoized consumers must retain their link.
  const refreshed = await build({
    entryPoints: ["src/context/stableContext.ts"], bundle: true, write: false, platform: "node", format: "cjs",
    define: { "import.meta.hot": "globalThis.__sqluitTestHot" },
    plugins: [{ name: "native-react", setup(builder) {
      const require = createRequire(import.meta.url);
      builder.onResolve({ filter: /^react$/ }, args => ({ path: require.resolve(args.path), external: true }));
    } }],
  });
  await writeFile(refreshFilename, refreshed.outputFiles[0].contents);
  const refreshedContext = createRequire(import.meta.url)(refreshFilename);
  assert.equal(api.refreshContext(refreshedContext.createStableContext), true, "Provider refresh must reuse the context of mounted consumers");
  const draft = document.getElementById("draft");
  draft.value = "SELECT name FROM Customers";
  await api.act(async () => {
    document.querySelector(".u219-language-toggle").click();
    await new Promise(resolve => setTimeout(resolve, 400));
  });
  assert.equal(document.getElementById("probe").textContent, "Practice sectionsLog out");
  assert.equal(document.querySelector(".problem-workspace-tabs").textContent, "Table DesignData ImportQuery");
  assert.equal(document.getElementById("cached-language").textContent, "en");
  assert.equal(document.documentElement.lang, "en");
  assert.equal(localStorage.getItem("sql-practice:language"), "en");
  assert.equal(document.getElementById("draft"), draft, "Switching must not remount the page");
  assert.equal(draft.value, "SELECT name FROM Customers");
  await api.act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
  await api.act(async () => {
    document.querySelector(".u219-language-toggle").click();
    await new Promise(resolve => setTimeout(resolve, 400));
  });
  assert.equal(document.getElementById("probe").textContent, "Các phần luyện tậpĐăng xuất");
  assert.equal(document.querySelector(".problem-workspace-tabs").textContent, "Thiết kế bảngNhập dữ liệuTruy vấn");
  assert.equal(document.getElementById("cached-language").textContent, "vi");
  assert.equal(document.documentElement.lang, "vi");
  await api.act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
  console.log("PASS: live language toggles update menu, navigation, teacher page and cached consumers together, preserve drafts, and persist the selection.");
} finally {
  if (root) await api.act(async () => root.unmount());
  await unlink(filename);
  await unlink(refreshFilename).catch(() => {});
  delete globalThis.__sqluitTestHot;
  dom.window.close();
}
