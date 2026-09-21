# Student frontend handoff

## Running and demo access

From the repository root, run `npm install`, then `npm start` (or `npm run dev`). Verify with `npm run test` and `npm run build`. Node.js 18+ is required. Vite chooses an available port; the active session uses http://127.0.0.1:5174/.

Continue as demo student signs in as `{ id: "student-demo", name: "Huy Lai", initials: "HL", email: "student@demo.local", role: "student" }`. Normal Login accepts a syntactically valid email and non-empty password; email `invalid@demo.local` or password `invalid` predictably fails. Registration validates name, email, password length/letter/number and password confirmation, then automatically creates a session and enters Dashboard. No secrets are saved.

## Route protection

`src/context/AuthContext.tsx` restores the namespaced mock session synchronously before rendering routes. `ProtectedRoute` redirects a signed-out visitor to Login and records pathname/query/hash in router state. Login restores only a recognized local Student destination. `PublicOnlyRoute` redirects signed-in Login/Register visits to Dashboard. Logout removes only `sql-practice:mock-session:v1`, clears context, and replaces the route with Login. Back navigation still passes through the guard.

Route map: `/` → Login/Dashboard; public-only `/login`, `/register`; protected `/dashboard`, `/practice`, `/workspace/:problemId`, `/assignments`, `/contests`, `/submissions`. Only one Workspace exists. Classes/Groups are tabs within Assignments, linking to protected `/assignments/classes/:scopeId` and `/assignments/groups/:scopeId` pages. Contests link to protected `/contests/:contestId`. Legacy `/contests?contest=ID` links redirect to the matching detail page. Unknown routes redirect to the entry page. Management routes, role-specific shells, generic management screens and the role switcher were removed.

## Code map

- `src/app/App.tsx`: route tree and Student shell; Workspace is loaded on demand.
- `src/context/`: mock session and theme contexts.
- `src/components/`: header, account control, route guards, calendar, activity, loading/table/dialog primitives.
- `src/pages/auth/AuthPages.tsx`: Login/Register and inline validation.
- `src/pages/student/`: the six Student screens.
- `src/data/mockData.ts`: centralized placeholder name and deterministic fixtures.
- `src/services/`: replaceable mock auth and Student API.
- `src/styles/`: one token system, global rules and component/responsive styles. `src/styles.css` only imports them; old conflicting styles were replaced.
- `tests/services.test.mjs`: real-service checks bundled in memory using the existing esbuild dependency.

## Backend replacement points

| Service                                                | Current demo contract                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `mockAuthService.login(email, password)`               | Validate/reject predictably and return a Student session                |
| `register(name, email, password)`                      | Validate and create a mock session                                      |
| `demoLogin()`                                          | Return the named demo Student                                           |
| `logout()` / `restoreSession()`                        | Remove/restore only the mock session key                                |
| `studentApi.getDashboard()`                            | Solved breakdown, continuing problems and deadlines                     |
| `getProblems(filters)` / `getProblem(id)`              | Problem list/detail with progress                                       |
| `getAssignments()`                                     | Enrolled classes, joined groups, assignments and deduplicated deadlines |
| `getContests()`                                        | Active, upcoming and closed contests                                    |
| `getSubmissions(filters)`                              | Search/result/source filtering plus new in-memory attempts              |
| `runQuery(id, query, database)`                        | Fixture table or deterministic mock error                               |
| `submitSolution(id, query, database, source, context)` | Mock verdict, history update and solved progress                        |
| `resetDatabase(id, database)`                          | Restore schema/sample rows without changing SQL draft                   |
| `getHint(id, mode)`                                    | Hint or mock AI guidance                                                |
| `getDraft(id)` / `saveDraft(id, query)`                | Namespaced local SQL drafts                                             |

Use short simulated delays only for this demo. Run selected sends the editor selection; Run all sends the whole draft. `-- mock:error` and `-- mock:timeout` trigger execution errors; `-- mock:wrong` triggers a wrong submission. Missing SELECT causes Runtime Error. Submit requires ORDER BY, and ranking additionally requires DENSE_RANK. These are text checks, not correctness grading. A successful mock run returns expected fixture rows regardless of actual SQL semantics.

Assignments and contest detail links pass source/context to the canonical Workspace. Upcoming/closed contests expose practice previews, not real participation. Countdown and the calendar's today are fixed demo values for September 18, 2026. Assignment records appear once in the combined calendar regardless of class/group views.

## Persistence and production limitations

Mock session, theme, favorites, notification read state and SQL drafts use namespaced localStorage keys. Passwords are never stored. Attempts/progress and reset sample state are in memory and reset on refresh. Blocked storage leaves the current session usable in memory. Logout retains theme/drafts and unrelated data.

Authentication, SQL execution, grading, AI, persistence and security are not production-ready. A frontend guard is not a security boundary. Replace mock services with real endpoints, choose a secure server-backed session strategy, enforce authentication/authorization and class/group membership server-side, sandbox database execution, limit resources, protect hidden tests, and perform grading on the server. Do not treat the mock AI or preview tables as real execution results.

## Figma references and remaining deviations

File: https://www.figma.com/design/A2mwI7yuWBhYWAMswSVrjw/Untitled

Retrieved reference nodes: Dashboard `25:112`; Practice `47:1290`; Workspace desktop light `65:2623`, desktop dark `78:3085`, mobile light `74:2950`, mobile dark `78:3105`; Assignments `91:112`; Contests `91:229`; Submissions `135:3190`; Login `7:3`; Register `7:4`.

Layout follows the contexts: horizontal header, one account identity, compact flat lists, activity/calendar, Classes/Groups with class context, featured contest bands, and the rule-divided workspace. Contests intentionally retains the featured gradients present in its retrieved frame. The exact database SVG export was downloaded locally. JetBrains Mono is used for the Student interface and SQL; auth uses Inter. Fonts load from Google Fonts, with local fallbacks when offline.

Intentional differences: auth copy is English while the retrieved auth frames use Vietnamese; Full name, explicit password rules and demo entry were added as required. Mock fixtures show two classes/one group, eight problems and five seeded submissions rather than every reference row. Submissions adds score/actions required by the prompt. Real SQL, real AI and real contest registration are outside the frontend scope. Calendar opens matching work on date selection. The header uses an icon with the replaceable app name as its accessible label/title because no approved name appeared in retrieved frames. Other Student mobile pages use responsive stacking/menu/table scrolling; Workspace, shared header and class/group detail mobile contexts were retrieved.

Dark-theme primary buttons use dark foreground text on the light purple accent for readability; this differs from the white button labels in the retrieved dark Workspace frame.

## Verification record

`npm run test`: application TypeScript plus mock service regression checks for authentication/session restoration/logout, predictable rejection, registration, filters, query verdicts, submission history/progress, reset preserving drafts, AI guidance and calendar relationships.

`npm run build`: TypeScript project build and Vite production bundle. HTTP checks cover the entry, both auth routes, all six Student pages, the exported icon and transformed source modules. HTTP success verifies delivery, not browser rendering or route-guard behavior.

No route was visually inspected in a browser at desktop 1440×900 or mobile 390×844, light or dark. Computer Use stopped because it could not reliably determine Chrome's URL to enforce policy; the user instructed us not to retry or bypass that restriction. No baseline app screenshot was captured. Figma screenshots/context were inspected, but app screenshot comparison, measured overflow, browser Back/session UI checks and browser console verification remain unperformed. Responsive/keyboard behavior was reviewed in source; service behavior was tested. Pixel-perfect matching is not claimed.

## September 18 Figma update

See [FIGMA_UPDATE_REPORT.md](FIGMA_UPDATE_REPORT.md) for additional inspected frames and implementation details. Theme selection is inside the account menu. Notifications and streak popovers are shared by every Student header, including Workspace. Each new submission captures query and database independently of the editable draft. Auto and instructor scores remain separate. Favorites persist locally; attempts, progress and contest completion remain in memory. Streaks use an illustrative accepted-day history plus in-memory Accepted attempts, calculated by ICT calendar date; an inactive streak is muted.

Page 2.2 revision: PracticeSidebar.tsx contains the desktop numbered activity calendar/mobile heatmap and selectable trending ranges. My Lists collapse/create and mobile filters are implemented in PracticePage.tsx. User-created private lists capture the current result IDs and persist locally. Additional trending Workspace fixtures p9/p10 are excluded from the default eight-row Practice catalogue. Replace illustrative activity/trending data and local lists with Student backend adapters when integrating.

Latest Assignment revision: the list follows the updated shared grid/mobile rows and calendar dialog, with four classes and two joined groups. Assignment deadlines exclude contests and completed work. Six work fixtures include five pending assignments. Updated detail links reuse the canonical workspace; pending counts and group relationships derive from fixture IDs. The small class roster is still illustrative.

## UX quality pass
Audited the existing Student flows against the repository architecture and referenced Figma frames. High-impact fixes in this pass: Practice and Submissions now keep the current result surface visible while filter/search data refreshes, avoiding full-list loading flicker; each Dialog gets a unique generated title ID so multiple dialog instances remain correctly labelled for assistive technology. No product redesign or new dependencies were introduced. Remaining limitations are documented above: browser visual inspection remains unavailable, mock services retain demo latency for execution/submission feedback, and real backend persistence is outside scope.
