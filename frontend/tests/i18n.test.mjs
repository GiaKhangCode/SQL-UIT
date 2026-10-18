import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditUi } from "../scripts/i18n-audit.mjs";

const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const output = await build({
  stdin: { contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import { LanguageProvider } from "./src/context/LanguageContext";
    import { ThemeProvider } from "./src/context/ThemeContext";
    import { AppearanceSettings } from "./src/components/AppearanceSettings";
    import { Status } from "./src/components/ui";
    import { AdminRolesPage } from "./src/pages/admin/AdminPages";
    import { WorkspaceTypeSelector } from "./src/pages/teacher/problem-editor/WorkspaceTypeSelector";
    import { WORKSPACE_PART_DETAILS } from "./src/utils/workspaceParts";
    import { adminCapabilities } from "./src/data/adminPolicy";
    export * from "./src/i18n";
    export { messageTemplates } from "./src/i18n/messages";
    export { WORKSPACE_PART_DETAILS, adminCapabilities };
    export function renderSample(kind) {
      const child = kind === "settings" ? <AppearanceSettings /> : kind === "admin" ? <AdminRolesPage /> : kind === "teacher" ?
        <WorkspaceTypeSelector value={['DDL', 'SQL']} onChange={() => {}} /> : <Status value="Wrong Answer" />;
      return renderToStaticMarkup(<ThemeProvider><LanguageProvider><MemoryRouter>{child}</MemoryRouter></LanguageProvider></ThemeProvider>);
    }
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".css": "empty" },
  // These pages only need icons and form controls for server rendering.
  logLevel: "silent", define: { "process.env.NODE_ENV": '"production"', "import.meta.hot": "undefined" },
});
const filename = join(tmpdir(), `sqluit-i18n-${process.pid}.cjs`);
try {
  await writeFile(filename, output.outputFiles[0].contents);
  const { catalogs, createTranslator, messageTemplates, renderSample, WORKSPACE_PART_DETAILS, adminCapabilities } = createRequire(import.meta.url)(filename);
  const allVi = Object.assign({}, ...Object.values(catalogs.vi));
  for (const scope of ["common", "student", "teacher", "admin", "auth", "workspace"]) {
    const vi = catalogs.vi[scope], en = catalogs.en[scope];
    assert.ok(Object.keys(vi).length > 20, `Empty role catalog: ${scope}`);
    assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(vi)) {
      assert.ok(value.length > 0 || key === "s", `Empty translation: ${scope}/${key}`);
      const allowed = new Set(key.match(/\{\w+\}/g) ?? []);
      for (const token of value.match(/\{\w+\}/g) ?? []) assert.ok(allowed.has(token), `Unknown interpolation ${token}: ${key}`);
    }
  }
  for (const key of messageTemplates) assert.ok(key in allVi, `Missing message template: ${key}`);
  for (const { label } of adminCapabilities) assert.ok(label in allVi, `Missing capability: ${label}`);
  for (const { title, description } of Object.values(WORKSPACE_PART_DETAILS)) {
    assert.ok(title in allVi); assert.ok(description in allVi);
  }
  const vi = createTranslator("vi", "teacher"), en = createTranslator("en", "teacher");
  assert.equal(vi("New problem"), "Tạo đề mới");
  assert.equal(en("New problem"), "New problem");
  assert.equal(vi("Showing {start}–{end} of {total} problems", { start: 1, end: 15, total: 46 }), "Hiển thị 1–15 / 46 bài");
  assert.equal(vi("User $1 (A+B) was added successfully."), "Đã thêm User $1 (A+B) thành công.");
  assert.equal(en("User $1 (A+B) was added successfully."), "User $1 (A+B) was added successfully.");
  assert.equal(vi("Created class IS207.R14"), "Đã tạo lớp IS207.R14");
  assert.equal(vi("SELECT name FROM Students WHERE name = 'Draft'"), "SELECT name FROM Students WHERE name = 'Draft'");
  assert.equal(vi("Unknown server detail"), "Unknown server detail");
  const node = { value: "Draft" };
  assert.equal(vi(node), node); assert.equal(vi(0), 0); assert.equal(vi(undefined), undefined);
  for (const language of ["vi", "en"]) {
    memory.set("sql-practice:language", language);
    const admin = renderSample("admin"), teacher = renderSample("teacher"), student = renderSample("student");
    assert.ok(admin.includes(language === "vi" ? "Quyền giảng dạy" : "Teaching access"));
    assert.ok(admin.includes(language === "vi" ? "Quản lý tài khoản và vai trò" : "Manage accounts &amp; roles"));
    assert.ok(teacher.includes(language === "vi" ? "Thiết kế lược đồ" : "Schema design"));
    assert.equal((teacher.match(/checked=""/g) ?? []).length, 2);
    assert.ok(student.includes(language === "vi" ? "Sai kết quả" : "Wrong Answer"));
    assert.ok(student.includes('class="status danger"'));
    assert.ok(student.includes('<i18n-text class="i18n-motion-text">'), "Student status participates in the shared text transition");
    assert.ok(admin.includes('<i18n-text class="i18n-motion-text">'), "Admin page labels are animated");
    assert.ok(teacher.includes('<i18n-text class="i18n-motion-text">'), "Teacher page labels are animated");
    for (const theme of ["light", "dark"]) {
      memory.set("sql-practice:theme", theme);
      const settings = renderSample("settings");
      assert.ok(settings.includes(language === "vi" ? "Ngôn ngữ" : "Language"));
      assert.ok(settings.includes(language === "vi" ? "Giao diện" : "Appearance"));
      assert.ok(settings.includes(`data-dark="${theme === "dark"}"`));
      assert.equal((settings.match(/<button/g) ?? []).length, 2, "One theme toggle and one language toggle in the compact settings panel");
      assert.ok(settings.includes(`lang="${language}"`));
      assert.ok(settings.includes(language === "vi" ? "Tiếng Việt" : "English"));
    }
  }
  const audit = auditUi(allVi);
  assert.deepEqual(audit.errors, [], audit.errors.join("\n"));
  console.log(`PASS: ${Object.keys(allVi).length} translations, six scopes, bilingual role rendering, message parameters, preserved SQL/form values; ${audit.files} UI files audited.`);
} finally { await unlink(filename); }
