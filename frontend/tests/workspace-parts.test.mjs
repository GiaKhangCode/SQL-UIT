import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = await build({
  stdin: { contents: `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { WorkspaceNavigation } from "./src/pages/student/workspace/components/WorkspaceNavigation";
    import { WorkspaceTypeSelector } from "./src/pages/teacher/problem-editor/WorkspaceTypeSelector";
    export * from "./src/utils/workspaceParts";
    export const renderNavigation = (parts, active) => renderToStaticMarkup(createElement(WorkspaceNavigation, { parts, active, onChange: () => {} }));
    export const renderSelector = value => renderToStaticMarkup(createElement(WorkspaceTypeSelector, { value, onChange: () => {} }));
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"production"', "import.meta.hot": "undefined" },
});
const filename = join(tmpdir(), `sqluit-workspace-parts-${process.pid}.cjs`);
try {
  await writeFile(filename, output.outputFiles[0].contents);
  const { workspaceParts, workspaceDraftKey, renderNavigation, renderSelector } = createRequire(import.meta.url)(filename);
  assert.deepEqual(workspaceParts(undefined), ["SQL"]);
  assert.deepEqual(workspaceParts(["SQL", "DDL", "DDL", "invalid"]), ["DDL", "SQL"]);
  assert.deepEqual(workspaceParts([]), []);
  for (let mask = 1; mask < 8; mask++) {
    const parts = ["DDL", "DML", "SQL"].filter((_, index) => mask & (1 << index));
    const navigation = renderNavigation(parts, parts[0]);
    assert.equal((navigation.match(/<button/g) || []).length, parts.length);
    assert.equal((navigation.match(/aria-current="page"/g) || []).length, 1);
    for (const part of ["DDL", "DML", "SQL"]) assert.equal(navigation.includes(`<b>${part}</b>`), parts.includes(part));
    const selector = renderSelector(parts);
    assert.equal((selector.match(/type="checkbox"/g) || []).length, 3);
    assert.equal((selector.match(/checked=""/g) || []).length, parts.length);
  }
  assert.match(renderSelector([]), /role="alert"/);
  const key = workspaceDraftKey("u1", "p1", "a1");
  assert.notEqual(key, workspaceDraftKey("u2", "p1", "a1"));
  assert.notEqual(key, workspaceDraftKey("u1", "p2", "a1"));
  assert.notEqual(key, workspaceDraftKey("u1", "p1", "a2"));
  assert.notEqual(workspaceDraftKey("a:b", "c", "d"), workspaceDraftKey("a", "b:c", "d"));
  console.log("PASS: all 7 workspace combinations, checkbox/navigation rendering, defaults and draft isolation.");
} finally { await unlink(filename); }
