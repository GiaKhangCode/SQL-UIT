export type TeacherProblem = {
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
  schema: string;
  seedData: string;
  seedSummary: string;
  referenceSolution: string;
  expectedColumns: string[];
  expectedRows: (string | number)[][];
  testCases?: { seedData: string; isHidden: boolean }[];
};

export type TeacherClass = {
  id: string;
  course: string;
  term: string;
  students: number;
  mode: "Group work" | "Individual" | string;
  status: "Active" | "Archived" | string;
  startDate?: string;
  endDate?: string;
  groups: {
    id: string;
    members: number;
    lastSubmission: string;
  }[];
};

export type TeacherClassMember = {
  id?: string;
  name: string;
  email?: string;
  role: string;
  joinedAt?: string;
};
