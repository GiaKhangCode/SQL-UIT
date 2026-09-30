export const APP_NAME = "UIT-SQL";

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
  instructions: string;
  classIds: string[];
  date: string;
  time: string;
  status: Progress;
  problemIds: string[];
  problemProgress: Record<string, Progress>;
};

export type Contest = {
  id: string;
  title: string;
  status: "Live" | "Upcoming" | "Closed";
  date: string;
  time: string;
  endTime: string;
  endDate?: string;
  scope: string;
  audienceType: "classes" | "all_students";
  shortDescription: string;
  description: string;
  rules: string;
  bannerUrl?: string | null;
  opensAt: string;
  closesAt: string;
  problemCount: number;
  problemDetails: { id: string; title: string; difficulty: string; topic: string; points?: number }[];
  totalPoints: number;
  score: number;
  rank: number | null;
  leaderboardEnabled: boolean;
  aiAllowed: boolean;
  leaderboard: { rank: number; student: string; score: number }[];
  participants?: number;
  submitters?: number;
  problemIds: string[];
};

export type Submission = {
  id: string;
  problemId: string;
  source: "Practice" | "Assignments" | "Contests";
  context: string;
  contextTitle?: string;
  result: Verdict;
  score: number;
  submittedAt: string;
  query?: string;
  database?: string;
  evaluatedScore?: number;
  feedback?: string;
  maxScore?: number;
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
