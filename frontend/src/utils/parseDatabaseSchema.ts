export type SchemaColumn = {
  name: string;
  type: string;
  constraints: string;
};

export type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
  constraints: string[];
  primaryKeys: string[];
  foreignKeys: { columns: string[]; referencedTable: string; referencedColumns: string[] }[];
};

function closingParenthesis(source: string, openIndex: number) {
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

function splitDefinitions(body: string) {
  const definitions: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote) {
        if (body[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "[") quote = "]";
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      definitions.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }

  definitions.push(body.slice(start).trim());
  return definitions.filter(Boolean);
}

function unquote(identifier: string) {
  const value = identifier.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).replace(/\]\]/g, "]");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  if (value.startsWith("`") && value.endsWith("`")) {
    return value.slice(1, -1);
  }
  return value;
}

function tableName(rawName: string) {
  const parts = rawName.match(/(?:\[[^\]]+\]|"(?:[^"]|"")+"|`[^`]+`|[^.])+/g) || [rawName];
  return unquote(parts[parts.length - 1]);
}

function parseColumn(definition: string): SchemaColumn | null {
  const match = definition.match(/^(\[[^\]]+\]|"(?:[^"]|"")+"|`[^`]+`|[^\s]+)\s+([\s\S]+)$/);
  if (!match) return null;

  const remainder = match[2].trim();
  const constraint = /\b(?:CONSTRAINT\b|NOT\s+NULL\b|NULL\b|PRIMARY\s+KEY\b|UNIQUE\b|IDENTITY\b|DEFAULT\b|REFERENCES\b|CHECK\b|COLLATE\b)/i.exec(remainder);
  const type = (constraint ? remainder.slice(0, constraint.index) : remainder).trim();

  return {
    name: unquote(match[1]),
    type: type || remainder,
    constraints: constraint ? remainder.slice(constraint.index).trim() : "",
  };
}

export function parseDatabaseSchema(schema: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const createTable = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:\[[^\]]+\]|"(?:[^"]|"")+"|`[^`]+`|[\w.])+?)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = createTable.exec(schema))) {
    const openIndex = createTable.lastIndex - 1;
    const closeIndex = closingParenthesis(schema, openIndex);
    if (closeIndex < 0) continue;

    const columns: SchemaColumn[] = [];
    const constraints: string[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: SchemaTable["foreignKeys"] = [];
    for (const definition of splitDefinitions(schema.slice(openIndex + 1, closeIndex))) {
      if (/^(?:CONSTRAINT\b|PRIMARY\s+KEY\b|FOREIGN\s+KEY\b|UNIQUE\b|CHECK\b)/i.test(definition)) {
        const foreignKey = definition.match(/\bFOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
        const primaryKey = definition.match(/\bPRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (foreignKey) {
          foreignKeys.push({
            columns: foreignKey[1].split(",").map(unquote),
            referencedTable: tableName(foreignKey[2]),
            referencedColumns: foreignKey[3].split(",").map(unquote),
          });
        }
        if (primaryKey) primaryKeys.push(...primaryKey[1].split(",").map(unquote));
        if (!foreignKey) constraints.push(definition);
      } else {
        const column = parseColumn(definition);
        if (column) {
          columns.push(column);
          if (/\bPRIMARY\s+KEY\b/i.test(column.constraints)) primaryKeys.push(column.name);
          const inlineForeignKey = column.constraints.match(/\bREFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
          if (inlineForeignKey) {
            foreignKeys.push({
              columns: [column.name],
              referencedTable: tableName(inlineForeignKey[1]),
              referencedColumns: inlineForeignKey[2].split(",").map(unquote),
            });
          }
        }
      }
    }

    if (columns.length) {
      tables.push({ name: tableName(match[1]), columns, constraints, primaryKeys: [...new Set(primaryKeys)], foreignKeys });
    }
    createTable.lastIndex = closeIndex + 1;
  }

  const identifier = String.raw`(?:\[[^\]]+\]|"(?:[^"]|"")+"|` + "`[^`]+`" + String.raw`|[\w.])+`;
  const alterForeignKey = new RegExp(
    String.raw`\bALTER\s+TABLE\s+(${identifier})\s+ADD\s+(?:CONSTRAINT\s+${identifier}\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(${identifier})\s*\(([^)]+)\)`,
    "gi",
  );
  let alterMatch: RegExpExecArray | null;
  while ((alterMatch = alterForeignKey.exec(schema))) {
    const sourceTable = tables.find((candidate) => candidate.name.toLowerCase() === tableName(alterMatch![1]).toLowerCase());
    if (!sourceTable) continue;
    sourceTable.foreignKeys.push({
      columns: alterMatch[2].split(",").map(unquote),
      referencedTable: tableName(alterMatch[3]),
      referencedColumns: alterMatch[4].split(",").map(unquote),
    });
  }

  const alterPrimaryKey = new RegExp(
    String.raw`\bALTER\s+TABLE\s+(${identifier})\s+ADD\s+(?:CONSTRAINT\s+${identifier}\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)`,
    "gi",
  );
  let primaryKeyMatch: RegExpExecArray | null;
  while ((primaryKeyMatch = alterPrimaryKey.exec(schema))) {
    const table = tables.find((candidate) => candidate.name.toLowerCase() === tableName(primaryKeyMatch![1]).toLowerCase());
    if (table) table.primaryKeys = [...new Set([...table.primaryKeys, ...primaryKeyMatch[2].split(",").map(unquote)])];
  }

  return tables;
}
