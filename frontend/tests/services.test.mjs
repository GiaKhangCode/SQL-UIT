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
  classes: [{ id: "C1", code: "SQL", name: "SQL", lecturer: "Teacher" }],
  assignments: [
    { id: "A1", title: "Exercise", instructions: "Solve the query.", isContest: false, classIds: ["C1"], problemIds: ["P1"], problemProgress: { P1: "Not started" } },
    { id: "T1", title: "Sprint", isContest: true, classIds: ["C1"], audienceType: "classes", scope: "SQL", contestStatus: "Upcoming", shortDescription: "Quick SQL sprint", description: "## About", rules: "Solve both problems", opens: "2026-09-25T10:00:00Z", closes: "2026-09-25T11:30:00Z", problemIds: [], problemCount: 1, problemDetails: [], submitters: 0, score: 0, totalPoints: 20, rank: null, leaderboardEnabled: true, aiAllowed: false, leaderboard: [], problemProgress: { P1: "Not started" } },
    { id: "T2", title: "Campus sprint", isContest: true, classIds: [], audienceType: "all_students", scope: "All students", contestStatus: "Live", shortDescription: "Open to campus", description: "## Campus", rules: "Submit before closing", bannerUrl: "/api/assignments/banners/campus.webp", opens: "2026-09-25T10:00:00Z", closes: "2026-09-25T11:30:00Z", problemIds: ["P1"], problemCount: 1, problemDetails: [{ id: "P1", title: "First query", difficulty: "Easy", topic: "SELECT" }], submitters: 2, score: 10, totalPoints: 20, rank: 2, leaderboardEnabled: true, aiAllowed: false, leaderboard: [], problemProgress: { P1: "In progress" } },
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
  if (url.startsWith("/api/student/dashboard?tz_offset=")) return response({ solved: 0, easy: 0, medium: 0, hard: 0, continuing: [], deadlines: [], currentStreak: 0, submissionsPerDay: [] });
  if (url === "/api/problems") return response([
    { id: "P1", title: "First query", number: "001", topic: "SELECT, WHERE", topics: ["SELECT", "WHERE"], difficulty: "Easy", progress: null, practiceListed: true },
    { id: "P2", title: "Private class query", number: "002", topic: "JOIN", topics: ["JOIN"], difficulty: "Hard", progress: null, practiceListed: false },
  ]);
  if (url === "/api/assignments") return response(catalog);
  if (url.startsWith("/api/assignments/")) {
    const item = catalog.find(activity => activity.id === decodeURIComponent(url.slice("/api/assignments/".length)));
    return response(item || { detail: "Not found" }, item ? 200 : 404);
  }
  if (url === "/api/failure") return response({ detail: "Specific server error" }, 400);
  throw new Error(`Unexpected request: ${url}`);
};

const output = await build({
  stdin: {
    contents: "export * from './src/services/authService'; export * from './src/services/studentApi'; export * from './src/services/apiClient'; export * from './src/utils/contestMarkdown'; export * from './src/utils/contestBanner'; export * from './src/utils/featuredContests';",
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { authService, studentApi, apiFetch, readContestMarkdown, contestBannerClass, contestBannerStyle, selectFeaturedContests, TOKEN_KEY, SESSION_KEY } = await import(
  "data:text/javascript;base64," + Buffer.from(output.outputFiles[0].text).toString("base64")
);

const user = await authService.login("instructor@demo.local", "password123");
assert.equal(user.role, "instructor");
assert.equal(memory.get(TOKEN_KEY), "signed-token");
const loginBody = JSON.parse(calls.find(call => call.url === "/api/auth/login").options.body);
assert.equal(loginBody.email, "instructor@demo.local");
assert.equal(loginBody.password, "password123");
assert.equal((await authService.restoreSessionAsync()).id, "teacher-1");

const assignments = await studentApi.getAssignments();
assert.deepEqual(assignments.assignments.map(item => item.id), ["A1"]);
assert.equal(assignments.assignments[0].instructions, "Solve the query.");
const dashboard = await studentApi.getDashboard();
assert.deepEqual(dashboard.deadlines.map(item => item.id), ["A1"]);
assert.equal(dashboard.deadlines[0].time, new Date(`${futureUtc[0]}T${futureUtc[1]}:00Z`).toTimeString().slice(0, 5));
assert.deepEqual((await studentApi.getProblems({ progress: "Not started" })).map(item => item.id), ["P1"]);
assert.deepEqual((await studentApi.getProblems({ topic: "WHERE" })).map(item => item.id), ["P1"]);
const contests = await studentApi.getContests();
assert.deepEqual(contests.map(item => item.id), ["T1", "T2"]);
assert.deepEqual(contests[0].problemIds, []);
assert.equal(contests[0].problemCount, 1);
assert.equal(contests[1].submitters, 2);
assert.equal(contests[1].scope, "All students");
assert.equal(contests[1].shortDescription, "Open to campus");
assert.equal(contests[1].bannerUrl, "/api/assignments/banners/campus.webp");
assert.equal(contests[0].status, "Upcoming");
assert.equal(contestBannerClass("T2"), contestBannerClass("T2"));
assert.match(contestBannerStyle(contests[1].bannerUrl).backgroundImage, /campus\.webp/);
assert.equal(contestBannerStyle(null), undefined);
const featuredCandidate = (id, status, opensAt) => ({ id, title: id, status, opensAt });
assert.deepEqual(selectFeaturedContests([]), []);
assert.deepEqual(selectFeaturedContests([featuredCandidate("U1", "Upcoming", "2026-10-01T09:00:00Z")]).map(item => item.id), ["U1"]);
assert.deepEqual(selectFeaturedContests([
  featuredCandidate("U2", "Upcoming", "2026-10-02T09:00:00Z"),
  featuredCandidate("L2", "Live", "2026-10-02T10:00:00Z"),
]).map(item => item.id), ["L2", "U2"]);
assert.deepEqual(selectFeaturedContests([
  featuredCandidate("C1", "Closed", "2026-09-01T09:00:00Z"),
  featuredCandidate("U3", "Upcoming", "2026-10-03T09:00:00Z"),
  featuredCandidate("U1", "Upcoming", "2026-10-01T09:00:00Z"),
  featuredCandidate("L1", "Live", "2026-10-04T09:00:00Z"),
  featuredCandidate("L0", "Live", "2026-10-03T09:00:00Z"),
]).map(item => item.id), ["L0", "L1", "U1", "U3"]);
assert.deepEqual(selectFeaturedContests([
  featuredCandidate("L3", "Live", "2026-10-03T09:00:00Z"),
  featuredCandidate("L1", "Live", "2026-10-01T09:00:00Z"),
  featuredCandidate("L2", "Live", "2026-10-02T09:00:00Z"),
]).map(item => item.id), ["L1", "L2", "L3"]);
assert.deepEqual(selectFeaturedContests(Array.from({ length: 4 }, (_, index) =>
  featuredCandidate(`U${index}`, "Upcoming", `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`),
)).map(item => item.id), ["U0", "U1", "U2", "U3"]);
assert.deepEqual(selectFeaturedContests([
  featuredCandidate("L1", "Live", "2026-10-01T09:00:00Z"),
  ...Array.from({ length: 5 }, (_, index) => featuredCandidate(`U${index}`, "Upcoming", `2026-10-${String(index + 2).padStart(2, "0")}T09:00:00Z`)),
]).map(item => item.id), ["L1", "U0", "U1", "U2", "U3", "U4"]);
assert.equal(selectFeaturedContests(Array.from({ length: 6 }, (_, index) =>
  featuredCandidate(`L${index}`, "Live", `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`),
)).length, 6);
assert.equal(selectFeaturedContests(Array.from({ length: 8 }, (_, index) =>
  featuredCandidate(`U${index}`, "Upcoming", `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`),
)).length, 6);
const markdown = "## Campus sprint\nSolve SQL problems.";
assert.equal(await readContestMarkdown({ name: "contest.md", size: markdown.length, text: async () => markdown }), markdown);
await assert.rejects(() => readContestMarkdown({ name: "contest.html", size: 4, text: async () => "bad" }), /Markdown/);
assert.ok(calls.filter(call => call.url === "/api/student/assignments").every(call => call.options.headers.Authorization === "Bearer signed-token"));
assert.equal(calls.filter(call => call.url.startsWith("/api/assignments/")).length, 0);
await assert.rejects(() => apiFetch("/api/failure"), /Specific server error/);
authService.logout();
assert.equal(memory.get(TOKEN_KEY), undefined);
deferSessionCheck = true;
await authService.login("instructor@demo.local", "password123");
const staleRestore = authService.restoreSessionAsync();
assert.ok(pendingSessionCheck);
authService.logout();
pendingSessionCheck.resolve({ id: "teacher-1", name: "Teacher", initials: "T", email: "instructor@demo.local", role: "instructor" });
assert.equal(await staleRestore, null);
assert.equal(memory.get(SESSION_KEY), undefined);

await authService.login("instructor@demo.local", "password123");
const staleFailure = authService.restoreSessionAsync();
authService.logout();
await authService.login("instructor@demo.local", "password123");
pendingSessionCheck.reject(new Error("Old request failed"));
assert.equal(await staleFailure, null);
assert.equal(memory.get(TOKEN_KEY), "signed-token");
assert.ok(memory.get(SESSION_KEY));
deferSessionCheck = false;
authService.logout();

console.log("PASS: authenticated service calls, session races, enrolled contest filtering, assignment separation, and API errors.");
