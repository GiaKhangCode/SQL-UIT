export type SeedTable = {
  name: string;
  columns: string[];
  rows: string[][];
};

function stripComments(sql: string) {
  let result = "";
  let quote: string | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      result += char;
      if (char === quote) {
        if (sql[index + 1] === quote) result += sql[++index];
        else quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      result += char;
    } else if (char === "[") {
      quote = "]";
      result += char;
    } else if (char === "-" && sql[index + 1] === "-") {
      while (index < sql.length && sql[index] !== "\n") index += 1;
      result += "\n";
    } else if (char === "/" && sql[index + 1] === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        if (sql[index] === "\n") result += "\n";
        index += 1;
      }
      index += 1;
      result += " ";
    } else {
      result += char;
    }
  }

  return result;
}

function matchingParenthesis(source: string, openIndex: number) {
  let depth = 0;
  let quote: string | null = null;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "[") quote = "]";
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function splitSqlList(source: string) {
  const values: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "[") quote = "]";
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      values.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  values.push(source.slice(start).trim());
  return values;
}

function displayValue(value: string) {
  const trimmed = value.trim();
  const stringValue = trimmed.match(/^[nN]?'((?:''|[^'])*)'$/);
  if (stringValue) return stringValue[1].replace(/''/g, "'");
  return /^NULL$/i.test(trimmed) ? "NULL" : trimmed;
}

function readRows(source: string, startIndex: number) {
  const rows: string[][] = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (source[cursor] !== "(") break;

    const closeIndex = matchingParenthesis(source, cursor);
    if (closeIndex < 0) return null;
    rows.push(splitSqlList(source.slice(cursor + 1, closeIndex)).map(displayValue));
    cursor = closeIndex + 1;

    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (source[cursor] === ",") {
      cursor += 1;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source[cursor] === "(") continue;
      break;
    }
    if (source[cursor] === ";") cursor += 1;
    break;
  }

  return rows.length ? { rows, endIndex: cursor } : null;
}

function cleanIdentifier(identifier: string) {
  const value = identifier.trim();
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1).replace(/\]\]/g, "]");
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/""/g, '"');
  if (value.startsWith("`") && value.endsWith("`")) return value.slice(1, -1);
  return value;
}

function displayTableName(rawName: string) {
  const parts = rawName.match(/(?:\[[^\]]+\]|"(?:[^"]|"")+"|`[^`]+`|[^.])+/g) || [rawName];
  return cleanIdentifier(parts[parts.length - 1]);
}

export function parseSeedData(seedData: string): SeedTable[] {
  const sql = stripComments(seedData);
  const insertStatement = /\bINSERT\s+INTO\s+((?:\[[^\]]+\]|"(?:[^"]|"")+"|`[^`]+`|[\w.])+?)\s*\(([^)]*)\)\s*VALUES\b/gi;
  const tables = new Map<string, { name: string; columns: string[]; rowValues: Map<string, string>[] }>();
  let statement: RegExpExecArray | null;

  while ((statement = insertStatement.exec(sql))) {
    const columns = splitSqlList(statement[2]).map(cleanIdentifier);
    const parsedRows = readRows(sql, insertStatement.lastIndex);
    if (!columns.length || !parsedRows || parsedRows.rows.some((row) => row.length !== columns.length)) return [];

    const name = displayTableName(statement[1]);
    const key = name.toLowerCase();
    let table = tables.get(key);
    if (!table) {
      table = { name, columns: [], rowValues: [] };
      tables.set(key, table);
    }

    for (const column of columns) {
      if (!table.columns.includes(column)) table.columns.push(column);
    }
    for (const row of parsedRows.rows) {
      table.rowValues.push(new Map<string, string>(columns.map((column, index) => [column, row[index]] as const)));
    }
    insertStatement.lastIndex = parsedRows.endIndex;
  }

  return [...tables.values()].map((table) => ({
    name: table.name,
    columns: table.columns,
    rows: table.rowValues.map((row) => table.columns.map((column) => row.get(column) ?? "—")),
  }));
}
