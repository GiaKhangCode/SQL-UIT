import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const dom = new JSDOM('<div id="root"></div>');
const output = await build({
  stdin: { contents: `
    import React, { useState } from "react";
    export { act } from "react";
    export { createRoot } from "react-dom/client";
    import { BuilderProblemSettings } from "./src/pages/teacher/BuilderProblemSettings";
    export function Harness() {
      const [datasetVisibility, setDatasetVisibility] = useState({});
      const [parts, setParts] = useState(["DDL", "SQL"]);
      const [visibility, setVisibility] = useState({ databaseStructureVisible: true, databaseDescriptionVisible: true });
      return <BuilderProblemSettings problemId="p1" title="Customer exercise" visibility={visibility} onVisibilityChange={setVisibility} datasetVisibility={datasetVisibility} onDatasetVisibilityChange={setDatasetVisibility} parts={parts} closing={false} onClose={() => globalThis.closed = true} onClosed={() => {}} onPartsChange={setParts} onAdd={() => globalThis.added = parts} />;
    }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  loader: { ".css": "empty" }, define: { "import.meta.hot": "undefined" },
  plugins: [{ name: "mock-service", setup(build) {
    build.onResolve({ filter: /services\/teacherService$/ }, () => ({ path: "service", namespace: "mock" }));
    build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: `export const teacherService = { getProblem: async id => globalThis.problemDetail };` }));
  } }],
});
const filename = join(tmpdir(), `sqluit-builder-settings-${process.pid}.cjs`);
try {
  await writeFile(filename, output.outputFiles[0].contents);
  const { act, createRoot, Harness } = createRequire(import.meta.url)(filename);
  const React = createRequire(import.meta.url)("react");
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.problemDetail = {
    description: "Customer exercise statement", requirements: "Find customers",
    schema: "CREATE TABLE Customers (Id INT PRIMARY KEY);",
    databaseDescription: [{ tableName: "Customers", attributes: "Id", predicate: "Customer records" }],
    testCases: [{ seedData: "INSERT INTO Customers (Id) VALUES (1);", isHidden: true }],
    sqlSolutions: [{ id: "q", name: "Answer", query: "SELECT Id FROM Customers", enabled: true, timeLimitMs: 1500 }],
    expectedOutputs: [{ columns: ["Id"], rows: [[1]] }],
  };
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(Harness)));
  assert.ok(document.getElementById("builder-settings-DDL").textContent.includes("Customer records"));
  assert.ok(document.getElementById("builder-settings-DML").textContent.includes("Customers"));
  const queryContent = document.getElementById("builder-settings-SQL").textContent;
  assert.ok(!queryContent.includes("Find customers"), "Query settings omit requirements");
  assert.ok(!queryContent.includes("Customer exercise statement"), "Query settings omit statement");
  assert.ok(document.getElementById("builder-settings-DDL").textContent.includes("Customer exercise statement"), "Other section content is preserved");
  assert.equal(document.querySelectorAll(".builder-problem-settings pre, .builder-problem-settings code").length, 0, "Original SQL is not displayed in settings");
  assert.equal(document.querySelectorAll("#builder-settings-SQL .builder-settings-visibility button").length, 2, "Both visibility buttons are inside Query");
  await act(async () => document.querySelector('[aria-controls="builder-settings-SQL"]').click());
  const visibilityButtons = [...document.querySelectorAll('.builder-settings-visibility button')];
  assert.deepEqual(visibilityButtons.map(button => button.getAttribute("aria-pressed")), ["false", "false"]);
  await act(async () => visibilityButtons[0].click());
  assert.deepEqual(visibilityButtons.map(button => button.getAttribute("aria-pressed")), ["true", "false"]);
  await act(async () => visibilityButtons[1].click());
  assert.deepEqual(visibilityButtons.map(button => button.getAttribute("aria-pressed")), ["true", "true"]);
  await act(async () => visibilityButtons[0].click());
  assert.deepEqual(visibilityButtons.map(button => button.getAttribute("aria-pressed")), ["false", "true"]);
  const datasetButton = document.querySelector('#builder-settings-DML .builder-settings-dataset-heading button');
  assert.equal(datasetButton.getAttribute("aria-pressed"), "true", "Existing hidden dataset defaults are preserved");
  await act(async () => datasetButton.click());
  assert.equal(datasetButton.getAttribute("aria-pressed"), "false");
  await act(async () => datasetButton.click());
  assert.equal(datasetButton.getAttribute("aria-pressed"), "true");
  const toggles = [...document.querySelectorAll('input[type="checkbox"]')];
  assert.deepEqual(toggles.map(input => input.checked), [true, false, true]);
  const expand = document.querySelector('[aria-controls="builder-settings-DML"]');
  await act(async () => expand.click());
  assert.equal(expand.getAttribute("aria-expanded"), "true");
  assert.equal(toggles[1].checked, false, "Expanding content must not change enabled sections");
  await act(async () => toggles[1].click());
  await act(async () => document.querySelector("footer button").click());
  assert.deepEqual(globalThis.added, ["DDL", "DML", "SQL"]);
  for (const input of toggles) await act(async () => input.click());
  assert.ok(document.querySelector("footer button").disabled, "Cannot add without a section");
  await act(async () => document.querySelector('aside').dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(globalThis.closed, true);
  await act(async () => root.unmount());
  console.log("PASS: settings load saved content, expand independently, choose sections, validate add and close.");
} finally { await unlink(filename); dom.window.close(); }
process.exit(0);
