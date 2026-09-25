import assert from "node:assert/strict";
import { build } from "esbuild";

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};

const calls = [];
let deferSessionCheck = false;
let pendingSessionCheck = null;
const futureUtc = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16).split("T");
const pastUtc = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 16).split("T");
const enrolled = {
  classes: [{ id: "C1", code: "SQL", name: "SQL", lecturer: "Teacher", mode: "Individual" }],
  groups: [],
  assignments: [
    { id: "A1", title: "Exercise", classId: "C1", problemIds: ["P1"] },
    { id: "T1", title: "Sprint", classId: "C1", problemIds: ["P1"] },
  ],
  deadlines: [
    { id: "A1", title: "Exercise", date: futureUtc[0], time: futureUtc[1], kind: "Assignment", to: "/assignments?work=A1" },
    { id: "old", title: "Old work", date: pastUtc[0], time: pastUtc[1], kind: "Assignment", to: "/assignments" },
  ], problems: [],
};
const catalog = [
  { id: "A1", isContest: false, published: true },
  { id: "T1", title: "Sprint", isContest: true, published: true, status: "Scheduled", opens: "2026-09-25T10:00:00Z", closes: "2026-09-25T11:30:00Z", classes: "C1", submitted: "2/12", problemList: [{ id: "P1" }] },
  { id: "T2", title: "Other class", isContest: true, published: true, opens: "2026-09-25T10:00:00Z", closes: "2026-09-25T11:30:00Z", classes: "C2", submitted: "0/12", problemList: [] },
  { id: "T3", title: "Draft", isContest: true, published: false, opens: "2026-09-25T10:00:00Z", closes: "2026-09-25T11:30:00Z", classes: "C1", submitted: "0/12", problemList: [] },
];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  const response = (body, status = 200) => ({
    ok: status < 400, status,
    headers: { get: () => "application/json" },
    json: async () => body,
  });
  if (url === "/api/auth/login") return response({ access_token: "signed-token", user: { id: "teacher-1", name: "Teacher", initials: "T", email: "instructor@demo.local", role: "instructor" } });
  if (url === "/api/auth/me") {
    if (deferSessionCheck) return new Promise((resolve, reject) => {
      pendingSessionCheck = { resolve: body => resolve(response(body)), reject };
    });
    return response({ id: "teacher-1", name: "Teacher", initials: "T", email: "instructor@demo.local", role: "instructor" });
  }
  if (url === "/api/student/assignments") return response(enrolled);
  if (url === "/api/student/dashboard") return response({ solved: 0, easy: 0, medium: 0, hard: 0, continuing: [], deadlines: [], currentStreak: 0, submissionsPerDay: [] });
  if (url === "/api/problems") return response([
    { id: "P1", title: "First query", number: "001", topic: "SELECT, WHERE", topics: ["SELECT", "WHERE"], difficulty: "Easy", progress: null, practiceListed: true },
    { id: "P2", title: "Private class query", number: "002", topic: "JOIN", topics: ["JOIN"], difficulty: "Hard", progress: null, practiceListed: false },
  ]);
  if (url === "/api/assignments") return response(catalog);
  if (url === "/api/failure") return response({ detail: "Specific server error" }, 400);
  throw new Error(`Unexpected request: ${url}`);
};

const output = await build({
  stdin: {
    contents: "export * from './src/services/authService'; export * from './src/services/studentApi'; export * from './src/services/apiClient';",
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { authService, studentApi, apiFetch, TOKEN_KEY, SESSION_KEY } = await import(
  "data:text/javascript;base64," + Buffer.from(output.outputFiles[0].text).toString("base64")
);

const user = await authService.login("teacher", "123");
assert.equal(user.role, "instructor");
assert.equal(memory.get(TOKEN_KEY), "signed-token");
const loginBody = JSON.parse(calls.find(call => call.url === "/api/auth/login").options.body);
assert.equal(loginBody.email, "instructor@demo.local");
assert.equal(loginBody.password, "password123");
assert.equal((await authService.restoreSessionAsync()).id, "teacher-1");

const assignments = await studentApi.getAssignments();
assert.deepEqual(assignments.assignments.map(item => item.id), ["A1"]);
const dashboard = await studentApi.getDashboard();
assert.deepEqual(dashboard.deadlines.map(item => item.id), ["A1"]);
assert.equal(dashboard.deadlines[0].time, new Date(`${futureUtc[0]}T${futureUtc[1]}:00Z`).toTimeString().slice(0, 5));
assert.deepEqual((await studentApi.getProblems({ progress: "Not started" })).map(item => item.id), ["P1"]);
assert.deepEqual((await studentApi.getProblems({ topic: "WHERE" })).map(item => item.id), ["P1"]);
const contests = await studentApi.getContests();
assert.deepEqual(contests.map(item => item.id), ["T1"]);
assert.deepEqual(contests[0].problemIds, ["P1"]);
assert.equal(contests[0].submitters, 2);
assert.equal(contests[0].status, "Upcoming");
assert.ok(calls.filter(call => call.url === "/api/assignments").every(call => call.options.headers.Authorization === "Bearer signed-token"));
await assert.rejects(() => apiFetch("/api/failure"), /Specific server error/);
authService.logout();
assert.equal(memory.get(TOKEN_KEY), undefined);
deferSessionCheck = true;
await authService.login("teacher", "123");
const staleRestore = authService.restoreSessionAsync();
assert.ok(pendingSessionCheck);
authService.logout();
pendingSessionCheck.resolve({ id: "teacher-1", name: "Teacher", initials: "T", email: "instructor@demo.local", role: "instructor" });
assert.equal(await staleRestore, null);
assert.equal(memory.get(SESSION_KEY), undefined);

await authService.login("teacher", "123");
const staleFailure = authService.restoreSessionAsync();
authService.logout();
await authService.login("teacher", "123");
pendingSessionCheck.reject(new Error("Old request failed"));
assert.equal(await staleFailure, null);
assert.equal(memory.get(TOKEN_KEY), "signed-token");
assert.ok(memory.get(SESSION_KEY));
deferSessionCheck = false;
authService.logout();

console.log("PASS: authenticated service calls, session races, enrolled contest filtering, assignment separation, and API errors.");
