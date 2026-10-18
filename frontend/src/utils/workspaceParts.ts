import type { WorkspacePart } from "../data/models";

export const WORKSPACE_PARTS: WorkspacePart[] = ["DDL", "DML", "SQL"];
export const WORKSPACE_PART_DETAILS: Record<WorkspacePart, { title: string; description: string }> = {
  DDL: { title: "Schema design", description: "CREATE TABLE, ALTER TABLE, primary keys and foreign keys" },
  DML: { title: "Data manipulation", description: "Write INSERT, UPDATE and DELETE statements on the problem tables" },
  SQL: { title: "Data queries", description: "SELECT, JOIN, aggregation and result checking" },
};

export function workspaceParts(value: unknown): WorkspacePart[] {
  if (!Array.isArray(value)) return ["SQL"];
  return WORKSPACE_PARTS.filter(part => value.includes(part));
}

export function workspaceDraftKey(userId: string, problemId: string, context: string) {
  return `sql-practice:workspace:${encodeURIComponent(userId)}:${encodeURIComponent(context)}:${encodeURIComponent(problemId)}`;
}
