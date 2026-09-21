import {
  assignments,
  classes,
  contests,
  deadlines,
  groups,
  problems,
  submissions,
  type Progress,
  type Submission,
  type Verdict,
  type DataTable,
} from "../data/mockData";
import { delay, storage } from "./storage";
import { calculateStreak, demoAcceptedDays } from "./studentPreferences";
export type ProblemFilters = {
  includeTrending?: boolean;
  search?: string;
  topic?: string;
  difficulty?: string;
  progress?: string;
};
export type QueryResult = {
  status: "Tabular result" | Verdict;
  message: string;
  table?: DataTable;
};
const attempts: Submission[] = [];
const progress = new Map<string, Progress>();
// Deterministic simulation: no SQL is executed and no real grading occurs.
function evaluate(id: string, query: string, submit: boolean): QueryResult {
  const problem = problems.find((p) => p.id === id);
  const text = query.trim().toLowerCase();
  if (!problem)
    return { status: "Runtime Error", message: "This problem is unavailable." };
  if (!text || !/\bselect\b/.test(text))
    return {
      status: "Runtime Error",
      message: "The mock runner expects a SELECT statement.",
    };
  if (text.includes("mock:timeout"))
    return {
      status: "Time Limit Exceeded",
      message:
        "The simulated query exceeded the time limit. Review joins and filters.",
    };
  if (text.includes("mock:error") || text.includes("missingtable"))
    return {
      status: "Runtime Error",
      message: "The mock database could not find the requested table.",
    };
  if (
    submit &&
    (!text.includes("order by") ||
      text.includes("mock:wrong") ||
      (id === "p4" && !text.includes("dense_rank")))
  )
    return {
      status: "Wrong Answer",
      message:
        "The simulated result does not match the required rows, ordering or ranking.",
    };
  return {
    status: submit ? "Accepted" : "Tabular result",
    message: submit
      ? "Mock grading complete · demonstration checks passed."
      : "Mock preview · sample rows returned in 42 ms.",
    table: problem.expected,
  };
}
export const studentApi = {
  getLearningStreak: () => {
    const date = (value: Date) =>
      value.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    return calculateStreak(
      [
        ...demoAcceptedDays,
        ...attempts
          .filter((a) => a.result === "Accepted")
          .map((a) => date(new Date(a.submittedAt))),
      ],
      date(new Date()),
    );
  },
  getDashboard: () =>
    delay({
      solved: 24,
      easy: 16,
      medium: 7,
      hard: 1,
      continuing: problems.filter(
        (p) => (progress.get(p.id) || p.progress) === "In progress",
      ),
      deadlines,
    }),
  getProblems: (f: ProblemFilters = {}) =>
    delay(
      problems
        .filter((p) => f.includeTrending || p.practiceListed !== false)
        .map((p) => ({ ...p, progress: progress.get(p.id) || p.progress }))
        .sort((a, b) => a.number.localeCompare(b.number))
        .filter(
          (p) =>
            (!f.search ||
              `${p.title} ${p.number}`
                .toLowerCase()
                .includes(f.search.toLowerCase())) &&
            (!f.topic || p.topic === f.topic) &&
            (!f.difficulty || p.difficulty === f.difficulty) &&
            (!f.progress || p.progress === f.progress),
        ),
    ),
  getProblem: (id: string) => {
    const problem = problems.find((p) => p.id === id);
    return delay(
      problem
        ? { ...problem, progress: progress.get(id) || problem.progress }
        : undefined,
    );
  },
  getAssignments: () => delay({ classes, groups, assignments, deadlines }),
  getContests: () => delay(contests),
  getSubmissions: (
    f: { search?: string; result?: string; source?: string } = {},
  ) =>
    delay(
      [...attempts, ...submissions].filter(
        (s) =>
          (!f.search ||
            problems
              .find((p) => p.id === s.problemId)
              ?.title.toLowerCase()
              .includes(f.search.toLowerCase())) &&
          (!f.result || s.result === f.result) &&
          (!f.source || s.source === f.source),
      ),
    ),
  runQuery: (id: string, query: string, _database: string) =>
    delay(evaluate(id, query, false), 650),
  async submitSolution(
    id: string,
    query: string,
    _database: string,
    source: Submission["source"] = "Practice",
    context = "Practice",
  ) {
    const result = await delay(evaluate(id, query, true), 750);
    if (result.status !== "Tabular result")
      attempts.unshift({
        id: "local-" + Date.now(),
        problemId: id,
        source,
        context,
        result: result.status,
        score: result.status === "Accepted" ? 100 : 0,
        submittedAt: new Date().toISOString(),
        query,
        database: _database,
      });
    if (result.status === "Accepted") progress.set(id, "Solved");
    return result;
  },
  resetDatabase: (id: string, _database: string) =>
    delay(
      problems
        .find((p) => p.id === id)
        ?.tables.map((t) => ({ ...t, rows: t.rows.map((r) => [...r]) })) || [],
    ),
  getHint: (id: string, mode: "Hint" | "AI") =>
    delay(
      (mode === "AI" ? "Mock AI guidance: " : "") +
        (problems.find((p) => p.id === id)?.hint ||
          "Break the problem into smaller steps."),
    ),
  getDraft: (id: string) => storage.get("sql-practice:draft:" + id),
  saveDraft: (id: string, query: string) =>
    storage.set("sql-practice:draft:" + id, query),
};
