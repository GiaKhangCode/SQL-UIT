import assert from "node:assert/strict";
import { build } from "esbuild";

// Bundle the real TypeScript services into memory. No browser automation is used.
const result = await build({
  stdin: {
    contents:
      "export * from './src/services/mockAuthService'; export * from './src/services/studentApi'; export * from './src/services/studentPreferences';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const {
  mockAuthService,
  studentApi,
  SESSION_KEY,
  calculateStreak,
  demoAcceptedDays,
  getFavorites,
  getProblemLists,
  createProblemList,
  toggleFavorite,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
assert.equal(mockAuthService.restoreSession(), null);
await assert.rejects(() => mockAuthService.login("bad", "password"));
await assert.rejects(() =>
  mockAuthService.login("invalid@demo.local", "password"),
);
await assert.rejects(() =>
  mockAuthService.login("student@demo.local", "invalid"),
);
await assert.rejects(() =>
  mockAuthService.register("", "student@demo.local", "password1"),
);
const demo = await mockAuthService.demoLogin();
assert.deepEqual(demo, {
  id: "student-demo",
  name: "Huy Lai",
  initials: "HL",
  email: "student@demo.local",
  role: "student",
});
assert.deepEqual(mockAuthService.restoreSession(), demo);
assert.ok(!values.get(SESSION_KEY).includes("password"));
values.set("unrelated:key", "preserved");
mockAuthService.logout();
assert.equal(mockAuthService.restoreSession(), null);
assert.equal(values.get("unrelated:key"), "preserved");
values.set(SESSION_KEY, "malformed");
assert.equal(mockAuthService.restoreSession(), null);
const registered = await mockAuthService.register(
  "New Student",
  "new@school.edu",
  "Password1",
);
assert.equal(registered.initials, "NS");
assert.equal(registered.role, "student");
assert.deepEqual(mockAuthService.restoreSession(), registered);
mockAuthService.logout();
const filtered = await studentApi.getProblems({ difficulty: "Hard" });
assert.equal(filtered.length, 1);
assert.equal(
  (await studentApi.getProblems({ search: "no such title" })).length,
  0,
);
assert.equal(
  (await studentApi.getProblems({ topic: "JOIN", progress: "Not started" }))
    .length,
  2,
);
assert.equal((await studentApi.getProblems()).length, 8);
assert.equal(
  (await studentApi.getProblems({ includeTrending: true })).length,
  10,
);
assert.equal((await studentApi.getProblem("p9")).number, "041");
assert.equal((await studentApi.getProblem("p10")).number, "047");
const created = createProblemList("  JOIN revision  ", ["p1", "p6", "p1"]);
assert.equal(created[0].name, "JOIN revision");
assert.deepEqual(getProblemLists()[0].problemIds, ["p1", "p6"]);
values.set("sql-practice:lists", "malformed");
assert.deepEqual(getProblemLists(), []);
const problem = await studentApi.getProblem("p1");
assert.ok(problem);
assert.equal(await studentApi.getProblem("unknown"), undefined);
assert.equal(
  (await studentApi.runQuery("p1", problem.draft, "MySQL")).status,
  "Tabular result",
);
assert.equal(
  (await studentApi.runQuery("p1", "SELECT * FROM MissingTable", "MySQL"))
    .status,
  "Runtime Error",
);
assert.equal(
  (await studentApi.runQuery("p1", "SELECT 1; -- mock:timeout", "MySQL"))
    .status,
  "Time Limit Exceeded",
);
assert.equal(
  (await studentApi.submitSolution("p1", "SELECT 1", "MySQL")).status,
  "Wrong Answer",
);
assert.equal(
  (
    await studentApi.submitSolution(
      "p1",
      problem.draft,
      "Oracle",
      "Assignments",
      "JOIN practice",
    )
  ).status,
  "Accepted",
);
assert.equal(
  (await studentApi.getProblems({ search: problem.title }))[0].progress,
  "Solved",
);
const submissions = await studentApi.getSubmissions({
  source: "Assignments",
  result: "Accepted",
  search: problem.title,
});
assert.equal(submissions.length, 1);
assert.equal(submissions[0].context, "JOIN practice");
assert.equal(submissions[0].query, problem.draft);
assert.equal(submissions[0].database, "Oracle");
studentApi.saveDraft("p1", "SELECT my_draft");
assert.deepEqual(
  await studentApi.resetDatabase("p1", "SQL Server"),
  problem.tables,
);
assert.equal(studentApi.getDraft("p1"), "SELECT my_draft");
assert.equal(
  submissions[0].query,
  problem.draft,
  "Editing a draft must not mutate an attempt snapshot",
);
assert.deepEqual(calculateStreak(demoAcceptedDays, "2026-09-18"), {
  current: 7,
  best: 12,
  complete: true,
});
assert.deepEqual(
  calculateStreak(["2026-09-17", "2026-09-16", "2026-09-17"], "2026-09-18"),
  { current: 2, best: 2, complete: false },
);
assert.deepEqual(calculateStreak(["2026-09-16"], "2026-09-18"), {
  current: 0,
  best: 1,
  complete: false,
});
assert.deepEqual(calculateStreak([], "2026-09-18"), {
  current: 0,
  best: 0,
  complete: false,
});
assert.equal(toggleFavorite("p1"), true);
assert.deepEqual(getFavorites(), ["p1"]);
assert.equal(toggleFavorite("p1"), false);
assert.deepEqual(getFavorites(), []);
values.set("sql-practice:favorites", "malformed");
assert.deepEqual(getFavorites(), []);
values.set("sql-practice:favorites", JSON.stringify(["p2", 2, null]));
assert.deepEqual(getFavorites(), ["p2"]);
assert.ok(
  (await studentApi.getHint("p1", "AI")).startsWith("Mock AI guidance:"),
);
const data = await studentApi.getAssignments();
assert.equal(data.classes.length, 4);
assert.equal(data.groups.length, 2);
assert.equal(data.groups.find((g) => g.id === "g2").classId, "c3");
const assignmentDeadlines = data.deadlines.filter(
  (d) => d.kind === "Assignment",
);
assert.equal(assignmentDeadlines.length, 5);
assert.ok(
  !assignmentDeadlines.some((d) => d.id === "a6"),
  "Completed work should not appear as pending deadlines",
);
assert.ok(
  data.assignments.every(
    (a) =>
      !a.groupId ||
      data.groups.some((g) => g.id === a.groupId && g.classId === a.classId),
  ),
);
assert.equal(
  new Set(data.deadlines.map((d) => d.id)).size,
  data.deadlines.length,
);
assert.ok(
  data.groups.every((g) => data.classes.some((c) => c.id === g.classId)),
);
console.log(
  "PASS: mock authentication, restoration/logout, validation, filters, query verdicts, immutable submission snapshots, reset/draft preservation, streaks, favorites, hints and calendar relationships.",
);
