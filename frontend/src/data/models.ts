export const APP_NAME = "QueryLab";

export type Progress = "Solved" | "In progress" | "Not started";
export type Verdict =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Time Limit Exceeded";

export type DataTable = {
  name: string;
  columns: string[];
  rows: (string | number)[][];
};

export type Problem = {
  practiceListed?: boolean;
  id: string;
  number: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  progress: Progress;
  description: string;
  requirements: string;
  draft: string;
  tables: DataTable[];
  expected: DataTable;
  hint: string;
};

export type Assignment = {
  id: string;
  title: string;
  classId: string;
  groupId?: string;
  date: string;
  time: string;
  status: Progress;
  problemIds: string[];
};

export type Contest = {
  id: string;
  title: string;
  status: "Active" | "Upcoming" | "Closed";
  date: string;
  time: string;
  endTime: string;
  endDate?: string;
  scope: string;
  description: string;
  participants?: number;
  submitters?: number;
  problemIds: string[];
};

export type Submission = {
  id: string;
  problemId: string;
  source: "Practice" | "Assignments" | "Contests";
  context: string;
  result: Verdict;
  score: number;
  submittedAt: string;
  query?: string;
  database?: string;
  evaluatedScore?: number;
  feedback?: string;
};

export type Deadline = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "Assignment" | "Contest";
  context: string;
  to: string;
};
