import type { DataTable, WorkspacePart } from "./models";

export type TeacherSqlSolution = {
  description?: string;
  expectedOutputs?: DataTable[];
  expectedOutputVisible?: boolean;
  id: string;
  name: string;
  query: string;
  enabled: boolean;
  timeLimitMs: number;
};

export type TeacherProblem = {
  databaseDescription?: import("./models").DatabaseRelationDescription[];
  databaseDescriptionVisible?: boolean;
  workspaceParts?: WorkspacePart[];
  id: string;
  number: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  visibility: "Private" | "Public";
  topics: string;
  statement: string;
  requirements: string;
  hints: string[];
  database: string;
  schemaFileName: string;
  schema: string;
  seedData: string;
  seedSummary: string;
  referenceSolution: string;
  sqlSolutions?: TeacherSqlSolution[];
  expectedOutputs: DataTable[];
  expectedOutputVisible: boolean;
  expectedColumns: string[];
  expectedRows: (string | number)[][];
  testCases?: { seedData: string; isHidden: boolean }[];
};

export type TeacherClass = {
  id: string;
  course: string;
  term: string;
  students: number;
  status: "Active" | "Archived" | string;
  startDate?: string;
  endDate?: string;
};

export type TeacherClassMember = {
  id?: string;
  name: string;
  email?: string;
  role: string;
  joinedAt?: string;
};
