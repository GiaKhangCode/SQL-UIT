import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<div id="root"></div>');
const output = await build({
  stdin: { contents: `
    import React, { act } from "react";
    import { createRoot } from "react-dom/client";
    import { renderToStaticMarkup } from "react-dom/server";
    import { DatabaseDescriptionEditor } from "./src/pages/teacher/problem-editor/DatabaseDescriptionEditor";
    import { WorkspaceDatabasePanel } from "./src/pages/student/workspace/components/WorkspaceDatabasePanel";
    import { ProblemDatabaseDescription } from "./src/components/ProblemDatabaseDescription";
    export { act };
    export const mount = (el, props) => { const root = createRoot(el); root.render(<DatabaseDescriptionEditor {...props} />); return root; };
    export const renderDatabase = props => renderToStaticMarkup(<WorkspaceDatabasePanel database={{ schemaTables: [], tables: [{ name: "Students", columns: ["StudentId"], rows: [[1]] }] }} {...props} />);
    export const render = props => renderToStaticMarkup(<ProblemDatabaseDescription {...props} />);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty" }, define: { "import.meta.hot": "undefined" },
});
const filename = join(tmpdir(), `sqluit-database-description-${process.pid}.cjs`);
try {
  await writeFile(filename, output.outputFiles[0].contents);
  const { act, mount, render, renderDatabase } = createRequire(import.meta.url)(filename);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const rows = [{ tableName: "KHACHHANG", attributes: "MAKH, HOTEN", predicate: "Lưu khách hàng. <script>" }];
  assert.ok(render({ rows }).includes("KHACHHANG"));
  assert.ok(!render({ rows }).includes("<h3>"), "Relation descriptions form one continuous block without a separate heading");
  const database = renderDatabase({ description: rows });
  assert.ok(database.indexOf("KHACHHANG") < database.indexOf("Students"), "Relation descriptions appear before all database table information");
  assert.ok(!renderDatabase({ description: rows, descriptionVisible: false }).includes("KHACHHANG"));
  assert.ok(render({ rows }).includes("&lt;script&gt;"));
  assert.equal(render({ rows, visible: false }), "");
  assert.equal(render({ rows: [{ tableName: " ", attributes: "", predicate: "" }] }), "");
  let changed, visible;
  let root;
  await act(async () => { root = mount(document.getElementById("root"), { rows, visible: true, onChange: value => { changed = value; }, onVisibleChange: value => { visible = value; } }); });
  const collapse = document.querySelector('[aria-controls="database-description-fields"]');
  await act(async () => collapse.click());
  assert.equal(collapse.getAttribute("aria-expanded"), "false");
  assert.equal(document.querySelector("textarea").value, rows[0].attributes);
  await act(async () => collapse.click());
  assert.equal(collapse.getAttribute("aria-expanded"), "true");
  assert.equal(document.querySelector('.database-description-editor [aria-pressed]'), null, "Visibility controls belong to activity settings");
  await act(async () => document.querySelector('.database-description-fields > button').click());
  assert.equal(changed.length, 2);
  assert.deepEqual(changed[0], rows[0]);
  await act(async () => document.querySelector('.database-description-row-actions button').click());
  assert.deepEqual(changed, []);
  await act(async () => root.unmount());
  console.log("PASS: description rendering, visibility, collapse preserving input, add and remove.");
} finally { await unlink(filename); dom.window.close(); }
process.exit(0);
