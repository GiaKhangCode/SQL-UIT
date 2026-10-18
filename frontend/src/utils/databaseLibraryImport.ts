export type DatabaseLibrarySqlImport = {
  createTableSql: string;
  insertIntoSql: string;
  createTableCount: number;
  insertIntoCount: number;
};

export class DatabaseLibrarySqlImportError extends Error {
  constructor(
    readonly kind: "empty" | "no-supported-statements" | "unsupported-statement",
    readonly command = "",
  ) {
    super(kind);
    this.name = "DatabaseLibrarySqlImportError";
  }
}

type SqlLexState = "normal" | "single-quote" | "double-quote" | "bracket" | "line-comment" | "block-comment";

function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let statement = "";
  let state: SqlLexState = "normal";
  let blockDepth = 0;

  const finishStatement = () => {
    if (statement.trim()) statements.push(statement.trim());
    statement = "";
  };

  const lines = source.split(/(?<=\n)/);
  for (const line of lines) {
    if (state === "normal" && /^\s*GO\s*(?:--[^\r\n]*)?(?:\r?\n)?$/i.test(line)) {
      finishStatement();
      continue;
    }

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (state === "single-quote") {
        statement += char;
        if (char === "'" && next === "'") {
          statement += next;
          index += 1;
        } else if (char === "'") {
          state = "normal";
        }
        continue;
      }

      if (state === "double-quote") {
        statement += char;
        if (char === '"' && next === '"') {
          statement += next;
          index += 1;
        } else if (char === '"') {
          state = "normal";
        }
        continue;
      }

      if (state === "bracket") {
        statement += char;
        if (char === "]" && next === "]") {
          statement += next;
          index += 1;
        } else if (char === "]") {
          state = "normal";
        }
        continue;
      }

      if (state === "line-comment") {
        statement += char;
        if (char === "\n") state = "normal";
        continue;
      }

      if (state === "block-comment") {
        statement += char;
        if (char === "/" && next === "*") {
          statement += next;
          index += 1;
          blockDepth += 1;
        } else if (char === "*" && next === "/") {
          statement += next;
          index += 1;
          blockDepth -= 1;
          if (blockDepth === 0) state = "normal";
        }
        continue;
      }

      if (char === "-" && next === "-") {
        statement += char + next;
        index += 1;
        state = "line-comment";
      } else if (char === "/" && next === "*") {
        statement += char + next;
        index += 1;
        state = "block-comment";
        blockDepth = 1;
      } else if (char === "'") {
        statement += char;
        state = "single-quote";
      } else if (char === '"') {
        statement += char;
        state = "double-quote";
      } else if (char === "[") {
        statement += char;
        state = "bracket";
      } else if (char === ";") {
        finishStatement();
      } else {
        statement += char;
      }
    }
  }

  finishStatement();
  return statements;
}

function stripSqlComments(statement: string): string {
  let result = "";
  let state: SqlLexState = "normal";
  let blockDepth = 0;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    const next = statement[index + 1];

    if (state === "single-quote") {
      result += char;
      if (char === "'" && next === "'") {
        result += next;
        index += 1;
      } else if (char === "'") state = "normal";
      continue;
    }
    if (state === "double-quote") {
      result += char;
      if (char === '"' && next === '"') {
        result += next;
        index += 1;
      } else if (char === '"') state = "normal";
      continue;
    }
    if (state === "bracket") {
      result += char;
      if (char === "]" && next === "]") {
        result += next;
        index += 1;
      } else if (char === "]") state = "normal";
      continue;
    }
    if (state === "line-comment") {
      if (char === "\n") {
        result += "\n";
        state = "normal";
      }
      continue;
    }
    if (state === "block-comment") {
      if (char === "/" && next === "*") {
        index += 1;
        blockDepth += 1;
      } else if (char === "*" && next === "/") {
        index += 1;
        blockDepth -= 1;
        if (blockDepth === 0) {
          state = "normal";
          result += " ";
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      index += 1;
      state = "line-comment";
    } else if (char === "/" && next === "*") {
      index += 1;
      state = "block-comment";
      blockDepth = 1;
    } else {
      result += char;
      if (char === "'") state = "single-quote";
      else if (char === '"') state = "double-quote";
      else if (char === "[") state = "bracket";
    }
  }

  return result;
}

function statementKind(statement: string): "create" | "insert" | null {
  const clean = stripSqlComments(statement).trim();
  if (/^CREATE\s+TABLE\b/i.test(clean)) return "create";
  if (/^INSERT\s+INTO\b/i.test(clean)) return "insert";
  return null;
}

function commandName(statement: string): string {
  const words = stripSqlComments(statement).trim().match(/^[A-Za-z_]+(?:\s+[A-Za-z_]+)?/);
  return words?.[0] || "unknown";
}

export function parseDatabaseLibrarySql(source: string): DatabaseLibrarySqlImport {
  if (!source.trim()) throw new DatabaseLibrarySqlImportError("empty");

  const createStatements: string[] = [];
  const insertStatements: string[] = [];
  for (const statement of splitSqlStatements(source)) {
    const clean = stripSqlComments(statement).trim();
    if (!clean) continue;
    const kind = statementKind(statement);
    if (kind === "create") createStatements.push(statement);
    else if (kind === "insert") insertStatements.push(statement);
    else throw new DatabaseLibrarySqlImportError("unsupported-statement", commandName(statement));
  }

  if (!createStatements.length && !insertStatements.length) {
    throw new DatabaseLibrarySqlImportError("no-supported-statements");
  }

  return {
    createTableSql: createStatements.join(";\n\n") + (createStatements.length ? ";" : ""),
    insertIntoSql: insertStatements.join(";\n\n") + (insertStatements.length ? ";" : ""),
    createTableCount: createStatements.length,
    insertIntoCount: insertStatements.length,
  };
}

export function sqlFileBaseName(fileName: string): string {
  return fileName.replace(/\.sql$/i, "").toLowerCase().replace(/đ/g, "d").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "database";
}
