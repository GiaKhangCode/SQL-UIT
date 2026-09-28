# Proposed Student backend contract

Replace `src/services/mockAuthService.ts` and `src/services/studentApi.ts` with HTTP adapters while retaining readable page/service boundaries. The server must authenticate and authorize every request; localStorage sessions and frontend guards are not security controls.

| Method                                     | Suggested endpoint                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| login / register / logout / restoreSession | POST /auth/login, POST /auth/register, POST /auth/logout, GET /auth/session |
| getDashboard                               | GET /student/dashboard                                                      |
| getProblems / getProblem                   | GET /problems with search/topic/difficulty/progress, GET /problems/:id      |
| getAssignments                             | GET /student/assignments with enrolled classes and per-student progress     |
| getContests                                | GET /api/student/assignments (published contests with audience and lifecycle fields) |
| getSubmissions                             | GET /student/submissions with search/result/source                          |
| runQuery                                   | POST /problems/:id/run with SQL and database dialect                        |
| submitSolution                             | POST /problems/:id/submissions with SQL, dialect and source context         |
| resetDatabase                              | POST /problems/:id/reset                                                    |
| getHint                                    | POST /problems/:id/hints with mode                                          |

Use server-backed sessions selected by the backend team, return clear errors without stack traces, enforce class enrollment, isolate SQL execution, apply time/resource limits and keep grading/reference SQL private. Demo text-marker grading, deterministic fixture results and mock AI must be replaced. Validate contest availability and source context on the server. Deduplicate calendar work by assignment identity when a student shares multiple selected classes.

Current Contest create/update payloads use `isContest: true`, `audienceType: "classes" | "all_students"`, `classIds`, `shortDescription`, Markdown `description`, separate `rules`, start/end times, scored problems, and `studentOptions` with `leaderboard` and `aiAllowed`. All-students contests have no class IDs. Assignment payloads remain class-based and use `instructions`, hints, comments, and AI options. `GET /api/assignments/audience-count` returns the distinct active student count for the selected audience. Student Contest responses withhold problem IDs and details until the start time; contextual problem and submission endpoints enforce audience and timing.

Contest banners are optional. An instructor uploads a cropped WebP banner and a capped WebP source with `POST /api/assignments/banners` as multipart fields `banner` and `source`. The response contains `bannerUrl` and `bannerSourceUrl`. Contest create/update payloads also send those URLs and a compact `bannerCrop` JSON string for later adjustment; removal sends nulls. Student Contest responses expose only `bannerUrl`. The API serves the images at the returned URLs. Assignment builders do not send banner fields.

## Updated Student details and preferences

Dedicated class and contest routes must enforce enrollment and contest availability. Assignment progress and submissions belong to each student and assignment context. Notification content/ages and standings are illustrative and need authenticated server data.

Submission responses must include an immutable query snapshot and database dialect, with automatic score separate from any instructor evaluated score and feedback. Never substitute the editable draft for submitted SQL. Clipboard copy is a local UI action; opening a problem must preserve its draft.

Replace the demo accepted-day history with server-verified Accepted submission dates in the agreed timezone. Favorites and notification read state currently use local preferences; provide per-student persistence if needed. Enforce contest assistance restrictions server-side.
