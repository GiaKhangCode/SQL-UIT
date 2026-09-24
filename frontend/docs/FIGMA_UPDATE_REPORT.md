# Figma update report — September 18, 2026

The updated Figma file was reviewed through node-level design contexts, screenshots and read-only page/component inventory. Student-only scope applied during the earlier passes. Teacher Problem Editor, Teacher Management and Admin Management screens were added in the September 23 passes below.

## Reviewed changes

File: https://www.figma.com/design/A2mwI7yuWBhYWAMswSVrjw/Web-th%E1%BB%B1c-h%C3%A0nh-SQL-UIT

| Area                        | Inspected reference nodes                      |
| --------------------------- | ---------------------------------------------- |
| Dashboard and shared header | 25:112; Student header 387:1193 and 387:893    |
| Notifications               | Updates 390:1768; Events 390:1872              |
| Streak and account          | 390:1976; 392:2052                             |
| Practice                    | 47:1290                                        |
| Workspace                   | 65:2623; interaction annotations in 65:2624    |
| Class detail                | 91:179 desktop; 91:208 mobile                  |
| Group detail                | 326:1893 desktop; 326:1975 mobile              |
| Contests                    | 91:229 list; 91:279 detail; 116:2881 standings |
| Submissions                 | 135:3190 list; 138:4323 detail overlay         |

The shared header now uses notifications, learning streak and account identity. Appearance controls belong in the account menu. Practice includes a Favorite list and trending sidebar. Class/group views have dedicated detail layouts. Contest detail includes rules, problem links, participation and sample standings. Submission details preserve immutable SQL separately from the editable draft.

## Implemented behavior

- Shared Updates/Events popover, contextual destination links, persisted unread state, streak popover, account appearance selection and Logout. Only one header popover opens at a time. Escape returns focus, outside clicks/focus close it, and navigation dismisses it.
- Protected class, group and contest detail routes, with shared workspace links. Existing intended-route restoration accepts the new destinations. Legacy contest query links remain compatible.
- Class/group work and member sections use fixture relationships. Group 03 belongs to Database Systems. Member initials and the current Student identity are displayed coherently.
- Practice lists eight fixture problems in ID order, supports persistent favorites, and includes contextual trending links. The sidebar aligns with the filters.
- Dashboard learning/deadline regions scroll, expose keyboard focus, and use fixture counts rather than fabricated duplicate rows.
- Workspace adds Save, a separate reset action, SQL indentation formatting, caret position and editor expansion/restoration. Formatting uses CodeMirror indentation and preserves SQL tokens. Reset preserves drafts. Contest workspace links disable hints and AI.
- Submission drawer preserves list filters on close, shows immutable query/database snapshots, offers copy with a manual-copy fallback, and keeps auto/instructor scores separate. Opening a problem does not replace its draft.
- Streak calculations use unique accepted calendar days in ICT, including illustrative fixture history and new in-memory Accepted attempts. The reference date has a 7-day streak and 12-day best; an expired streak becomes muted.
- Existing conflicting account/header rules were removed or edited directly. Additional component/detail styles use the same theme tokens. CodeMirror language/view dependencies are declared directly and deduplicated.

## Main changed files

- src/components/AppHeader.tsx, SubmissionDetails.tsx and ui.tsx
- src/pages/student/AssignmentDetailPage.tsx and ContestDetailPage.tsx
- All six existing Student page components
- src/app/App.tsx, src/context/ThemeContext.tsx
- src/services/studentApi.ts and studentPreferences.ts
- src/data/mockData.ts, src/styles/components.css, student-updates.css and src/styles.css
- public/assets/notifications.svg, notifications-dark.svg, flame.svg and flame-dark.svg
- tests/services.test.mjs, package.json/package-lock.json, README and handoff documentation

## Verification

- npm run test: passes application TypeScript and service regression checks. New cases cover immutable query/database snapshots, draft independence, duplicate/out-of-order accepted days, missed-day streak expiry, empty streaks, favorites persistence/toggling and malformed preference data.
- npm run build: passes TypeScript project checking and Vite production bundling. The editor remains lazy loaded; the deduplicated editor chunk is below Vite's 500 kB warning threshold.
- HTTP: status 200 at http://127.0.0.1:5174/ for the entry, Login, Register, all six Student routes, /assignments/classes/c1, /assignments/groups/g1 and /contests/t1. Updated header/detail/editor source modules and all five local SVG assets also return 200.
- .codex-backup hashes match the preserved originals. No backup file was modified.
- Source inspection found no Teacher/Admin routes, screens, role switcher or navigation in src.
- Dependency installation reports two moderate advisories in the existing React Router dependency chain; resolution requires a major-version migration and was not included in this design update.

## Visual and functional limitations

No application route was visually inspected in a browser, at desktop or mobile sizes, in either theme. The previous Computer Use inspection was stopped because it could not reliably determine Chrome's URL; the user explicitly prohibited retrying or bypassing that restriction. No retry was attempted. Figma screenshots were inspected, but browser rendering, measured overflow, browser console and pixel comparisons remain unverified. HTTP success verifies delivery rather than rendering or authentication behavior.

Mock fixtures use two classes, one group, a four-member sample roster, three assignments and five seeded submissions. They do not reproduce every reference count or activity row. Dashboard currently has three in-progress fixtures rather than five repeated sample rows. Trending, notification ages, activity, contest availability and ranking times are illustrative. Streak dates follow the calendar and therefore change from the reference date. Logout is retained in the account menu although the new account reference concentrates on appearance.

Real SQL execution, AI, authentication, grading, contest registration and authorization remain outside this frontend implementation. Attempts, progress and contest completion reset on refresh. Session, theme, drafts, favorites and notification read state persist locally where storage is available. Hidden test cases, reference answers and server error internals are not exposed.

## Latest page 2.2 revision

Re-read the updated Practice desktop light (47:1290), desktop dark (51:1488), mobile light (52:1521), mobile dark (53:1616), and filter dialog (55:1970) contexts.

Practice now has the white/surface page background, a flat rule-divided problem list, neutral difficulty text, reference progress tag tones, and disabled single-page Previous/Next controls. The 304px desktop sidebar uses one enclosing border and contains a numbered September activity calendar, My Lists with collapse/create controls, and trending range tabs. The five-item desktop trending region has a 3px purple scrollbar with no native arrows. Mobile shows the compact actions, heatmap and three trending entries before the problem cards, with an Apply/Clear filters dialog.

Trending ranges switch illustrative ranking/count fixtures. New 041 Orders above average and 047 Running totals destinations use the canonical Workspace but are excluded from the default eight-row catalogue. Favorites can still display saved trending destinations. Private lists persist under sql-practice:lists and capture the current filtered result IDs when created; list creation is a frontend convenience.

Source/service verification covers the eight-row catalogue, ten available mock destinations, the two new Workspace IDs, list persistence/deduplication and malformed stored lists. Existing fixture progress remains mock data and may differ from the screenshot's sample statuses. Activity counts and learner counts are illustrative. Application browser comparison remains unavailable for the same previously documented Computer Use restriction; no browser/pixel-perfect verification is claimed.

Calendar color correction: re-read light contribution grid 247:117, light legend 247:163 and dark frame 51:1488. Replaced the binary active/inactive colors with the exact five-level Figma palettes and matching number foregrounds. The twelve active dates now match the reference; September 18 uses level 2 and September 20 is inactive. These tokens are scoped to the numbered Practice calendar/legend. Build verification passes; application browser comparison remains unavailable.

## Latest Assignment UI revision

Reviewed Assignments list desktop light 91:112, desktop dark 100:1412, mobile light 91:151, Groups desktop 326:1811 and updated class detail 91:179.

The Classes view now uses one bordered two-column grid with shared dividers and a fixed desktop content region, replacing independent spaced cards. Search and count align above it. Mobile uses compact glyph/identity/deadline rows with a Calendar dialog entry. The existing joined-group destinations remain discoverable through a small link; the Groups view keeps its scope tabs.

Fixtures now provide four classes (Database Systems, SQL Fundamentals, Advanced SQL and Data Analytics), two joined groups and six assignments, of which five remain pending. The Assignments calendar excludes contests and completed work; Dashboard still combines assignment/contest deadlines. Class/group relationships, pending counts and next due dates are derived from the fixtures. The reference calendar date is September 17 for this page, matching the updated frame; other calendar callers retain their prior reference date.

Class detail rows now use assignment codes, due/progress columns, and contextual Start/Continue/Review workspace links. All problems remain accessible through a read-only assignment dialog. Group roster displays respect the actual mock member count. The class roster remains a small illustrative fixture rather than the full 24-member Figma example.

The user-requested 2px scrollbar styling is retained instead of the new frame's wider decorative scroll track. Real scrollbars appear only when content actually overflows; the frame's long decorative thumb does not represent the four-card fixture height. Class work/problem counts use real fixture counts rather than copying inconsistent reference totals. No application browser screenshot comparison was performed because of the previously documented restriction.

### Assignment layout cleanup after screenshot feedback
Removed the fixed 628px list height, empty grid divider columns, and shared outer frame. Desktop classes now use separate bordered cards with a 16px gap and content-sized rows; scrolling is capped for longer lists. Mobile cards retain their compact 112px layout. This intentionally adjusts the earlier Figma grid in response to the user's screenshot feedback. Browser visual inspection remains unavailable; verification uses source inspection, tests, build, and HTTP.

### Class-only assignment view
Removed the Classes/Groups selector and separate group list from the Assignment landing page. Classes link to their detail pages, where the student's group and members remain visible. Group detail navigation returns to its owning class. The class cards sit inside a distinct white surface in light mode (theme surface in dark mode), with the desktop calendar overlapping the panel edge by 24px. Mobile retains the calendar dialog and padded class panel. Verified with npm run test, npm run build, and HTTP 200 for /assignments; browser visual inspection remains unavailable.

### Contest Hall of Fame fit
Reviewed latest Figma frame 91:229, Hall of Fame node 306:8866. Replaced the sidebar divider with a bordered surface card, 16px padding, compact 20px winner rows, and the published-results link (opens the Past contest filter). Uses a 336px desktop column, 280px tablet column, and full-width mobile card; height follows wrapped content instead of clipping to the design frame's 447px. Tests and production build passed, /contests returned HTTP 200. Browser visual inspection remains unavailable.

### New assignment problem details
Reviewed Figma class detail 91:179 and new assignment detail 452:368. Assignment row arrows now open protected /assignments/work/:assignmentId with due date, problem count, progress, status, and numbered problems with Start/Continue/Review workspace actions. Class cards retain navigation to their class detail. Uses actual mock problem counts, and preserves the user's white Assignment background and shared sidebar widths. Responsive layouts wrap summary columns and problem actions on mobile. Browser visual verification remains unavailable. Tests, build, and HTTP checks used for validation.

### Authentication v2 revision
Reviewed new Figma Authentication v2 frames 504:112 (Sign in), 504:157 (Register), and their dark variants. Reworked AuthLayout into the split 600px brand/editor preview plus centered 360px form panel. Login/Register copy, field density, button sizing, QueryLab wordmark, SQL preview, responsive mobile stacking, and theme control placement follow the new frames. Existing validation, demo login, intended-route restoration, registration, and theme behavior remain intact. Browser visual inspection remains unavailable; test and build verification passed.

### Dashboard v2 revision
Reviewed Figma node 19:112 and frame 506:1573 (Returning / Light v2). Dashboard now uses the v2 hierarchy: 1314px content, Continue Learning bordered list with Resume/View all actions, compact Deadlines rows with date blocks and This week strip, and a combined SQL Activity card with stats beside the heatmap. Existing mock data and routes remain the source for links and counts. Responsive tablet/mobile stacking was added. Tests and build passed; browser visual inspection remains unavailable.

### Authentication recovery screens
Reconnected to the current Figma file and reviewed its Authentication section. In addition to Sign in and Register, it contains Verify OTP (504:206), Forgot Password (504:247), and Reset Password (504:281), with dark variants 504:322 through 504:491. Added `/forgot-password`, `/verify-otp`, and `/reset-password` public routes. Forgot Password and Verify OTP use the centered form-only layout; Reset Password shares the split editor-preview layout. Sign in's Forgot password link now opens the recovery screen. Updated registration fields, password visibility controls, and placeholders to match the current frames.

The backend currently has no OTP, recovery-email, or password-reset endpoints. The recovery forms validate their inputs and show a clear unavailable message on submission; they do not claim to send a code or change a password. No backend behavior was added. The excluded Dashboard, Practice, and SQL Workspace screens were not reviewed. The previously reported class/group/contest/submission screens were not changed in this pass.

## Assignments, contests and submissions refresh — September 23, 2026

Reconnected to the current [SQL UIT Figma file](https://www.figma.com/design/A2mwI7yuWBhYWAMswSVrjw/Web-th%E1%BB%B1c-h%C3%A0nh-SQL-UIT) and compared the requested page sections using their desktop and mobile light frames:

| Screen | Reference frames |
| --- | --- |
| Assignments, class and assignment detail | 91:112, 91:151, 91:179, 91:208, 452:368 |
| Contest list and detail | 91:229, 91:258, 91:279, 91:308 |
| Submission list and detail | 135:3190, 135:3542, 138:4323, 138:4529 |

`studentApi.getAssignments()` and `getContests()` now return the existing typed fixtures. Their placeholder empty arrays left the updated assignment and contest views blank and triggered most of the supplied TypeScript build errors. The contest detail submission lookup now explicitly uses the `Submission` type.

The contest status tabs show counts derived from the fixture data, and the featured contests use a swipeable card row on mobile. Submission filters now follow Search, Source, Result; the desktop table matches the SQL problem, Source, Result, Submitted and chevron columns without a score column. Mobile uses compact tappable submission cards rather than a wide table. The submission drawer presents automatic and final scores separately, with an explicit pending state when there is no instructor score, keeps the submitted SQL read-only and preserves the draft when opening the problem.

No test suites were run. `npm run build` passes TypeScript and Vite production bundling. Vite reports the existing 585 kB lazy Workspace chunk above its 500 kB advisory threshold. The Figma light frames were inspected; application browser screenshots were not performed, consistent with the prior Computer Use restriction. Dashboard, Practice and SQL Workspace remain excluded from this review.

## Teacher interface demo — September 23, 2026

Reviewed the current Teacher Problem Editor and Teacher Management canvases, including light desktop/mobile frames and the problem editor operational-state reference:

| Screen | Figma frames |
| --- | --- |
| Problem editor | 365:113 desktop, 365:205 mobile, 368:112 operational states |
| Assignment builder | 367:6349 desktop, 367:6377 mobile |
| Classes and groups | 367:6405 desktop, 367:6433 mobile |
| Results | 367:6461 desktop, 367:6489 mobile |
| Manual review | 367:6517 desktop, 367:6545 mobile |
| Contest builder | 500:4041 desktop |

Added a role-specific Teacher area with Problems, Assignments, Classes and Results navigation. Assignment and contest builders share the Figma form layout; the assignment builder links to contest creation. Results link into manual review. Desktop uses the two-column editor and builder layouts; mobile stacks the forms, tables and grading sections to follow the reference frames. Existing theme tokens style both light and dark modes.

The login accepts the demo account `teacher` with password `123` and opens `/teacher/problems`. The demo session survives refresh in local storage and skips backend session verification. Drafts, publish state and review edits are stored locally; SQL validation, publishing, class changes, score review and CSV export are frontend demo behavior, with no teacher API calls.

`npm run build` passes TypeScript and Vite production bundling. The existing lazy Workspace chunk still triggers Vite's 500 kB advisory. Browser-based interaction and screenshot verification were not performed under the previously stated Computer Use restriction. No tests were run.

### Teacher Figma refresh — September 24, 2026

Rechecked the latest light desktop and mobile contexts for the Problem Editor (365:113, 365:205), Assignment builder (367:6349, 367:6377), Classes and groups (367:6405, 367:6433), Results (367:6461, 367:6489), Manual review (367:6517, 367:6545), and Contest builder (500:4041, 596:371). Also reviewed the Problem Editor operational states (368:112).

Updated Teacher navigation to include Contests. The Problem Editor now has Private/Public visibility and a Mark as ready action. Assignment and Contest builders now expose local Hints, Comments and Leaderboard switches. Classes and groups now show class join-request counts and an approval/rejection queue. Results include attempt counts and a Review action, and Manual review lets the demo switch between attempts and move between submissions.

These controls use local demo state and fixtures; no Teacher backend API was added. `npm run build` passes TypeScript and Vite production bundling. Vite retains its existing 585 kB Workspace chunk advisory. No tests were run. Browser screenshot verification was not performed under the previously stated Computer Use restriction.

## Admin interface demo — September 23, 2026

Reviewed the Admin Management canvas (366:5954), including the light desktop and mobile frames for:

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Users | 367:124 | 367:156 |
| Roles and permissions | 367:188 | 367:220 |
| Courses and classes | 367:252 | 367:284 |
| Lecturer assignment | 367:316 | 367:348 |
| Problem moderation | 367:380 | 367:412 |
| System overview | 367:444 | 367:476 |

Rechecked the current six desktop screens against the existing implementation. The only changed admin element was the shared navigation: its order is now Overview, Users, Courses, Practice, Moderation and Roles, with Practice opening the existing lecturer assignment screen. Updated the admin navigation label and order; page content and mobile layouts still match the reviewed frames.

Added an Admin area with Users, Roles, Courses, Lecturers, Moderation and Overview routes. The pages use the Figma compact header, rule-divided tables, split detail panels, responsive mobile rows and the shared light/dark theme tokens. The demo includes local interactions for account search/role/status, adding and deactivating accounts, role scope selection, class creation/archive, lecturer assignment, moderation actions and CSV export.

The login accepts `admin` with password `123` and opens `/admin/overview`. The demo session is kept locally and skips backend session verification. All admin records and actions are frontend fixtures; no backend API or persistence for admin management data was added.

`npm run build` passes TypeScript and Vite production bundling. Vite continues to report the existing 585 kB lazy Workspace chunk above its 500 kB advisory threshold. No tests were run. Browser-based interaction and screenshot verification were not performed under the previously stated Computer Use restriction.

### Teacher Figma follow-up — September 24, 2026

Rechecked all six Teacher screens in desktop and mobile light and dark variants, plus the Problem Editor operational states (365:113–251, 368:112, 367:6349–6559, 500:4041, 501:6286, 596:371–469). The latest Problem Editor adds a SQL seed-data editor and places Topics before Visibility. Assignment and Contest builders show a three-column problem table and use the main Teacher navigation to switch between builders. The Results screen ends at the submission count, while each result row leads to manual review. Manual review retains the test detail from its result fixture.

Updated the local demo to match those changes. Seed SQL and its summary now save with the problem draft, including compatibility with drafts saved before this field existed. Removed builder actions and table controls absent from Figma, removed the extra Results shortcut, and aligned the test detail and problem table columns. Theme styling continues to use the existing light/dark tokens.

`npm run build` passes TypeScript and Vite production bundling. The existing 585 kB lazy Workspace chunk advisory remains. No tests were run. Application browser screenshot verification was not performed.

### Teacher landing pages and Results refresh — September 24, 2026

Reviewed the updated Teacher Problem Library (596:675 desktop light, 596:828 desktop dark, 596:976 mobile light), Assignments (602:597, 602:745, 602:893), Contests (603:161, 603:331, 603:501), and Results (604:161, 604:309, 604:479) frames. Also checked the empty states for Problems (605:161), Assignments (605:317), Contests (605:495), and Classes (605:673), and the Assignment and Contest builder references (367:6349 and 500:4041).

Teacher sign-in now lands on the Problem library at `/teacher/problems`; the edit form opens from New problem or Edit. Assignments and Contests now open searchable, filterable list pages, with their existing builders at `/teacher/assignments/new` and `/teacher/contests/new`. Added the empty-state layouts for all four Teacher list areas. Rebuilt Results around assignment/contest activity with class, type and review filters, summary metrics, CSV export and actions leading into the demo review flow.

Added an AI assistance switch to both builder Student options. The disabled state is explicitly labeled “AI assistance is not allowed”; it defaults off for contests and on for assignments. Existing saved drafts without this field load using those defaults. Contest rule text follows the switch when toggled. Problem library edits, duplicates and deletions use browser-local demo data; assignment/contest list fixtures remain frontend-only.

`npm run build` passes TypeScript and Vite production bundling. Vite reports the existing 585 kB lazy Workspace chunk above its 500 kB advisory threshold. No tests were run. Application browser screenshot verification was not performed under the previously documented Computer Use restriction.

### Admin Figma refresh — September 24, 2026

Rechecked the current Admin Management canvas (366:5954), including desktop and mobile frames for Users (367:124–172), Roles and permissions (367:188–236), Courses and classes (367:252–300), Lecturer assignment (367:316–364), and System overview (367:444–492). Reviewed the new Lecturer approvals and Practice catalog desktop light/dark frames, plus their available mobile light frames and the approval rejection dialog variants (594:480, 610:532, 594:5831, 610:631, 610:747–1007, 612:660–998). Problem moderation is no longer on the current canvas; Practice catalog now occupies that navigation slot.

Updated Admin navigation to Overview, Users, Courses, Practice and Roles. Added the Users approval queue with lecturer approval and rejection demo actions, including the optional reason dialog; approval adds the lecturer to the demo user list. Replaced the old moderation route with a Practice catalog containing problem/topic tabs, search and filters, problem details, practice visibility, feature, comments and hints controls. Updated the role capability matrix for Practice catalog access, resized the Users/Courses filters to the reference proportions, sorted unassigned classes first, and added the overview's Needs attention table and links to approvals and lecturer assignment. The old moderation URL redirects to Practice, and the lecturer assignment route is nested under Courses.

The approval queue and account list persist in local demo storage; Practice catalog edits remain frontend-only demo state. No Admin backend API was added. `npm run build` passes TypeScript and Vite production bundling. Vite reports the existing 585 kB lazy Workspace chunk above its 500 kB advisory threshold. No tests were run. Application browser screenshot verification was not performed.

### Teacher classes term filter — September 24, 2026

Extended the existing Teacher template's Classes & groups page so it opens with **All terms** selected and displays the full local demo class list immediately. Replaced the season-style dropdown with academic term values such as Semester 1-2025 and Semester 2-2026. The list now shows each class's course and term, supports term-aware search/filtering, and updates its class/student count and selected-class details when filtered.

Terms and class records are frontend demo fixtures; no Teacher backend API was added. `npm run build` passes TypeScript and Vite production bundling. The existing 585 kB lazy Workspace chunk advisory remains. No tests or application browser screenshot comparison were performed.

### Teacher Classes sections removed — September 24, 2026

Removed the Join requests queue and Groups table from the Teacher Classes view, including the per-class join-request count column. The class list and class details remain. Removed the unused request fixtures and related styles. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher class progress detail — September 24, 2026

Expanded the selected-class panel into a progress overview. Selecting a class updates its student, assignment, submission and submission-rate metrics, class assignment list with submitted counts, and a searchable student snapshot with submission and assignment-completion counts. These progress records are frontend demo fixtures; real class activity will require the Teacher API. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher list actions cleanup — September 24, 2026

Removed Duplicate actions from the Problem library and Assignments list. Removed CSV export and Leaderboard actions from the Results page, leaving Open results as its row action. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher class selection follow-up — September 24, 2026

Made the full class row selectable, with a keyboard-focusable class control. Selecting a row now displays a concise class summary in the right panel and reveals a **View class details** button. The button opens the assignment submission breakdown and searchable student progress in a larger details dialog. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher list detail panels — September 24, 2026

Added selectable rows and right-side key detail panels for the Problem library, Contests and Results lists. The Problem and Contest panels link to their existing editors. The Results panel's **Edit** button opens the in-page result details dialog and does not navigate. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher Assignments detail panel — September 24, 2026

Added selectable assignment rows and a matching right-side panel with class, problem count, due date, submission count and status. Its **Edit** button links to the existing Assignment editor. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Teacher contest actions — September 24, 2026

Removed **Edit** from contest row actions. The selected contest detail panel now provides **Results** and **Leaderboard** actions, while row-level Preview, Duplicate and View actions remain where applicable. Leaderboard currently shows a demo notice. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.

### Assignment and Contest detail panels — September 24, 2026

Removed the Actions columns from the Assignments and Contests tables. Both lists now select the first visible item on load and show its details in the right panel. Assignment details include its classes, problem count, due date, submission progress and status, with Edit and Results actions. Contest details include classes, start time, duration, participant progress and status, with Results and Leaderboard actions. No tests were run.

### Problem library actions panel — September 24, 2026

Removed the Actions column from the Problem library table. Selecting the first visible or another problem displays its details and Edit/Delete controls in the right panel; the existing protection against deleting problems used by activities remains in place.

### Teacher assignment actions — September 24, 2026

Removed **Edit** from assignment row actions and added a **Results** button to the selected assignment detail panel beside its existing **Edit** button. Row-level **Results** remains available. `npm run build` passes; the existing 585 kB lazy Workspace chunk advisory remains. No tests were run.
