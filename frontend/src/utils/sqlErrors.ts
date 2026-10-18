export type SqlErrorDescription = {
  title: string;
  detail?: string;
  values?: Record<string, string>;
};

function cleanMessage(message: string) {
  return message
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\[?w_[a-f\d]{32}\]?\./gi, "")
    .replace(/\[(?:Microsoft|ODBC[^\]]*|SQL\s*Server|[0-9]{2}[A-Z\d]{3}|(?:HY|IM)[A-Z\d]{3})\]\s*/gi, "")
    .replace(/^\(?['"]?[A-Z\d]{5}['"]?,\s*["']?/, "")
    .replace(/\s*(?:\(\d+\)\s*)?\(SQL\w+\)[\s\S]*$/i, "")
    .replace(/["']\)$/, "")
    .trim();
}

export function describeSqlError(message: string): SqlErrorDescription {
  const clean = cleanMessage(message);
  const objectName = (name: string) => name.replace(/[\[\]]/g, "").replace(/^w_[a-f\d]{32}\./i, "");
  const missingTable = clean.match(/Invalid object name\s+['"]([^'"]+)['"]/i);
  if (missingTable) return { title: "Table {value0} was not found.", values: { value0: objectName(missingTable[1]) }, detail: "Check the table name and create it in DDL before using it." };
  const missingColumn = clean.match(/Invalid column name\s+['"]([^'"]+)['"]/i);
  if (missingColumn) return { title: "Column {value0} was not found.", values: { value0: missingColumn[1] }, detail: "Check the column name in your database diagram." };
  const syntax = clean.match(/Incorrect syntax near\s+['"]([^'"]+)['"]/i);
  if (syntax) return { title: "SQL syntax error near {value0}.", values: { value0: syntax[1] }, detail: "Check commas, parentheses, quotes and SQL keywords near this location." };
  if (/syntax error|parse error|incorrect syntax|unclosed quotation/i.test(clean)) return { title: "SQL syntax error.", detail: "Check commas, parentheses, quotes and SQL keywords near this location." };
  if (/duplicate key|violation of (?:PRIMARY KEY|UNIQUE)/i.test(clean)) return { title: "A primary key or unique value already exists.", detail: "Use a different value, or update the existing row." };
  if (/FOREIGN KEY|REFERENCE constraint/i.test(clean)) return { title: "Foreign key constraint conflict.", detail: "Check the related values and rows in the referenced tables." };
  const requiredColumn = clean.match(/Cannot insert the value NULL into column\s+['"]([^'"]+)['"]/i);
  if (requiredColumn) return { title: "Column {value0} requires a value.", values: { value0: requiredColumn[1] }, detail: "Provide a non-NULL value for this column." };
  const existingObject = clean.match(/already an object named\s+['"]([^'"]+)['"]/i);
  if (existingObject) return { title: "The name {value0} already exists.", values: { value0: objectName(existingObject[1]) }, detail: "Check your DDL for duplicate object names." };
  if (/column name or number of supplied values|fewer columns|more columns|fewer items|more items/i.test(clean)) return { title: "The number of columns and values does not match.", detail: "Each INSERT row must supply one value for each listed column." };
  if (/conversion failed|error converting data type|arithmetic overflow|would be truncated/i.test(clean)) return { title: "A value does not match the column data type.", detail: "Check the data type, value range and maximum text length." };
  if (/timeout|time limit|timed out|HYT0[01]/i.test(message)) return { title: "The query exceeded the time limit.", detail: "Simplify or optimize your query and run it again." };
  return { title: "SQL execution failed.", detail: clean || undefined };
}
