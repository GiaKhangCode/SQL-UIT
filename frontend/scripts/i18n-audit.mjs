import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const attributes = new Set(["title", "label", "placeholder", "aria-label", "description", "context", "sub", "primaryLabel", "secondaryLabel", "message", "data-label", "noun"]);
// Source code, SQL identifiers, sample data, file names and date format tokens.
const literalAllowlist = new Set([
  "KB", "name", "email", "orders", "join-orders.sql", "Nguyen An", "Tran Binh", "Le Chi", "Nguyen Van A",
  "AS-", "· SQL", "SQL Server", "ID", "DD", "MM", "YYYY", "hh", "mm", "SQL", "DDL", "DML",
  "schema.sql", ".sql", "solution.sql", "query.sql", "FOREIGN KEY", "B", "I", "</>", "A−", "A+", "PK", "FK",
  "──[ N : 1 ]──►", "name@example.com, teacher, or admin",
]);
const normalize = text => text.replace(/\s+/g, " ").trim().replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const isTechnical = text => literalAllowlist.has(text) || /^--/.test(text) || /^[\w.+-]+@[\w.-]+$/.test(text);

/** Audit source UI only. Runtime API/user content is deliberately outside this check. */
export function auditUi(catalog) {
  const errors = [];
  const referenced = new Set();
  const files = ["pages", "components", "app"].flatMap(folder =>
    fs.readdirSync(path.join(root, folder), { recursive: true })
      .filter(name => name.endsWith(".tsx"))
      .map(name => path.join(root, folder, name)),
  ).filter(file => !file.endsWith("LanguageSwitch.tsx"));
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, message) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      errors.push(`${path.relative(root, file)}:${line + 1}: ${message}`);
    };
    const checkLiteral = (node, text) => {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) && ["code", "pre"].includes(parent.openingElement.tagName.getText(source))) return;
      }
      text = normalize(text);
      if (/[A-Za-z]/.test(text) && !isTechnical(text)) report(node, `Untranslated UI: ${text}`);
    };
    function expression(node) {
      if (!node) return;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) checkLiteral(node, node.text);
      else if (ts.isConditionalExpression(node)) { expression(node.whenTrue); expression(node.whenFalse); }
      else if (ts.isParenthesizedExpression(node)) expression(node.expression);
      else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) expression(node.right);
    }
    function contains(node, predicate) {
      return predicate(node) || !!ts.forEachChild(node, child => contains(child, predicate));
    }
    function motionException(node) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) && ["TranslatedText", "LanguageText", "option", "select", "textarea", "code", "pre", "script", "style", "svg", "ReactMarkdown", "ProblemMarkdown", "CodeMirror"].includes(parent.openingElement.tagName.getText(source))) return true;
      }
      return false;
    }
    function visit(node) {
      if (ts.isJsxText(node)) checkLiteral(node, node.text);
      if (ts.isCallExpression(node) && ["t", "tr"].includes(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        referenced.add(key);
        if (!(key in catalog)) report(node, `Missing translation key: ${key}`);
      }
      if (ts.isJsxAttribute(node) && attributes.has(node.name.text) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) checkLiteral(node.initializer, node.initializer.text);
        else if (ts.isJsxExpression(node.initializer)) expression(node.initializer.expression);
      }
      if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) expression(node.expression);
      if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression && !motionException(node)) {
        const hasJsx = contains(node.expression, child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child));
        const hasTranslation = contains(node.expression, child => ts.isCallExpression(child) && ["t", "tr"].includes(child.expression.getText(source)));
        if (!hasJsx && hasTranslation) report(node, "Translated page text is missing its shared motion wrapper");
      }
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "option") {
        const value = node.openingElement.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === "value");
        if (!value) report(node, "An option must have an explicit untranslated value");
        else if (value.initializer && /\b(?:t|tr)\(/.test(value.initializer.getText(source))) report(value, "Translated option value changes form/API behavior");
        if (contains(node, child => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === "TranslatedText")) report(node, "Native options cannot contain animated markup");
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { errors, referenced, files: files.length };
}
