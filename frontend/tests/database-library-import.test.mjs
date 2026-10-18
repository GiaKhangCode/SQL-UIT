import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseLibrarySqlImportError, parseDatabaseLibrarySql, sqlFileBaseName } from "../src/utils/databaseLibraryImport.ts";

test("splits CREATE TABLE and INSERT INTO statements, including GO batches and quoted semicolons", () => {
  const result = parseDatabaseLibrarySql(`-- book tables
CREATE TABLE dbo.Authors (
  AuthorId INT PRIMARY KEY
)
GO
CREATE TABLE dbo.Books (
  BookId INT PRIMARY KEY,
  Title NVARCHAR(100)
);
INSERT INTO dbo.Authors (AuthorId) VALUES (1);
INSERT INTO dbo.Books (BookId, Title) VALUES (1, N'Bìa; xanh');
`);

  assert.equal(result.createTableCount, 2);
  assert.equal(result.insertIntoCount, 2);
  assert.match(result.createTableSql, /CREATE TABLE dbo\.Authors/);
  assert.match(result.createTableSql, /CREATE TABLE dbo\.Books/);
  assert.match(result.insertIntoSql, /N'Bìa; xanh'/);
  assert.doesNotMatch(result.createTableSql, /^\s*GO\s*$/m);
});

test("rejects the entire file when it contains a command outside the import scope", () => {
  assert.throws(
    () => parseDatabaseLibrarySql("CREATE TABLE T (Id INT);\nUPDATE T SET Id = 2;"),
    (error) => error instanceof DatabaseLibrarySqlImportError
      && error.kind === "unsupported-statement"
      && error.command === "UPDATE T",
  );
});

test("rejects an empty or comment-only SQL file", () => {
  assert.throws(() => parseDatabaseLibrarySql("  \n/* no statements */\n-- none\n"), (error) => error.kind === "no-supported-statements");
  assert.throws(() => parseDatabaseLibrarySql("\n  "), (error) => error.kind === "empty");
});

test("creates a safe file base name from a Vietnamese SQL filename", () => {
  assert.equal(sqlFileBaseName("Thư viện sách.sql"), "thu_vien_sach");
});
