# Student SQL frontend

A frontend-only university SQL learning demonstration built with Vite, React, TypeScript, React Router and CodeMirror. The centralized `APP_NAME` in `src/data/mockData.ts` is a replaceable placeholder because the inspected Figma frames contain a logo but no approved product name.

## Install and run

Use Node.js 18+ and npm:

```bash
npm install
npm start
# Alternatively: npm run dev
npm run test
npm run build
```

Vite prints the local URL; the current development server is at http://127.0.0.1:5174/. `npm run test` checks the actual application TypeScript project and runs service regression checks. `npm run build` checks both TypeScript projects and creates `dist/`.

## Demo sign-in

Choose **Continue as demo student** to immediately create a mock session for Huy Lai / HL / student@demo.local. The normal form accepts any valid email and non-empty password. Use `invalid@demo.local` or password `invalid` for predictable rejection. Do not enter real secrets.

Registration requires a full name, valid email and matching passwords with at least 8 characters, a letter and a number. It creates a mock Student session and enters Dashboard without OTP. Forgot password only displays a non-blocking explanation.

The session is stored under `sql-practice:mock-session:v1` and restored on refresh. Signed-out protected links redirect to Login with the intended path, query and hash preserved; successful login returns there. Existing sessions redirect Login/Register to Dashboard. Logout clears only the mock session and returns to Login; route guards also apply when navigating Back. Theme, favorites, notification read state and per-problem drafts persist separately. Storage failure falls back to an in-memory session.

## Student routes

| Route                   | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `/`                     | Redirect to Login or Dashboard according to session          |
| `/login`                | Login and demo entry                                         |
| `/register`             | Registration                                                 |
| `/dashboard`            | Continue learning, solved summary, activity and deadlines    |
| `/practice`             | Search and filter problems                                   |
| `/workspace/:problemId` | Canonical editor, database, mock execution, grading and help |
| `/assignments`          | Classes, joined groups, assignments and deadline calendar    |
| `/contests`             | Featured contests, status filters and contest details        |
| `/submissions`          | Searchable history and read-only submission details          |

Workspace IDs are `p1`–`p8`. Class detail lives at `/assignments/classes/:scopeId`, group detail at `/assignments/groups/:scopeId`, and contest detail at `/contests/:contestId`. These routes are protected and support intended-route restoration. Assignments and contests link to the same workspace with source/context query parameters. Unknown routes redirect to the appropriate entry page. No management routes or role switcher are provided.

## Mock boundary

`src/services/mockAuthService.ts` owns login, registration, demo login, logout and session restoration. `src/services/studentApi.ts` owns dashboard/problem/assignment/contest/submission reads, query runs, submission simulation, database reset, hints and drafts. Data fixtures live in `src/data/mockData.ts`. Replace these services with backend adapters; see `docs/FRONTEND_HANDOFF.md`.

The runner never executes SQL. It returns fixture rows and deterministic verdicts. Append `-- mock:error`, `-- mock:timeout` or `-- mock:wrong` to demonstrate errors (Wrong Answer applies to Submit). Submission simulation checks a few text markers only. Accepted attempts update Practice status and in-memory history until refresh. Database reset restores sample schema/data while retaining the SQL draft. AI returns guidance from fixtures.

Authentication, SQL execution, grading, AI, persistence and security are not production-ready. LocalStorage sessions and frontend guards are demo conveniences, not authorization. The backend must authenticate and authorize every request, enforce class/group scope, safely sandbox SQL, and grade on the server.

## Design and verification limits

The retrieved Figma node-level contexts and screenshots guided all six Student screens and Login/Register. The workspace uses continuous rule-divided panes, an in-pane bottom help drawer, and the Figma mobile Problem/SQL/Result tabs. Styles are rebuilt in one token/global/component system with light/dark modes. The exported Figma database icon is stored locally in `public/assets/database.svg`.

Browser inspection was unavailable: Computer Use stopped because it could not confidently determine Chrome's current URL. It was not retried or bypassed. No application route was visually inspected at 1440×900 or 390×844 in either theme; no pixel-perfect or console-error verification is claimed. Responsive source checks, TypeScript, service tests, production build and localhost HTTP checks were used instead. Remaining differences and exact reference nodes are documented in `docs/FRONTEND_HANDOFF.md`.

The latest Figma update adds shared notification/streak/account popovers, class/group/contest detail pages, a Favorite list, immutable submission SQL snapshots, and editor reset/indentation/expand actions. See [Figma update report](docs/FIGMA_UPDATE_REPORT.md) for inspected nodes, implementation choices and verification limits.
