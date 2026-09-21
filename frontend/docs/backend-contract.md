# Proposed Student backend contract

Replace `src/services/mockAuthService.ts` and `src/services/studentApi.ts` with HTTP adapters while retaining readable page/service boundaries. The server must authenticate and authorize every request; localStorage sessions and frontend guards are not security controls.

| Method                                     | Suggested endpoint                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| login / register / logout / restoreSession | POST /auth/login, POST /auth/register, POST /auth/logout, GET /auth/session |
| getDashboard                               | GET /student/dashboard                                                      |
| getProblems / getProblem                   | GET /problems with search/topic/difficulty/progress, GET /problems/:id      |
| getAssignments                             | GET /student/assignments with enrolled classes and joined groups            |
| getContests                                | GET /student/contests                                                       |
| getSubmissions                             | GET /student/submissions with search/result/source                          |
| runQuery                                   | POST /problems/:id/run with SQL and database dialect                        |
| submitSolution                             | POST /problems/:id/submissions with SQL, dialect and source context         |
| resetDatabase                              | POST /problems/:id/reset                                                    |
| getHint                                    | POST /problems/:id/hints with mode                                          |

Use server-backed sessions selected by the backend team, return clear errors without stack traces, enforce class/group membership, isolate SQL execution, apply time/resource limits and keep grading/reference SQL private. Demo text-marker grading, deterministic fixture results and mock AI must be replaced. Validate contest availability and source context on the server. Deduplicate calendar work by record identity, not its appearance in class/group views.

## Updated Student details and preferences

Dedicated class/group and contest routes currently reuse fixture reads; backend detail endpoints must enforce enrollment, group membership and contest availability. Notification content/ages and standings are illustrative and need authenticated server data.

Submission responses must include an immutable query snapshot and database dialect, with automatic score separate from any instructor evaluated score and feedback. Never substitute the editable draft for submitted SQL. Clipboard copy is a local UI action; opening a problem must preserve its draft.

Replace the demo accepted-day history with server-verified Accepted submission dates in the agreed timezone. Favorites and notification read state currently use local preferences; provide per-student persistence if needed. Enforce contest assistance restrictions server-side.
