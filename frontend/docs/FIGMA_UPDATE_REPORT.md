# Figma update report — September 18, 2026

The updated Figma file was reviewed through node-level design contexts, screenshots and read-only page/component inventory. Student-only scope is retained. Teacher Problem Editor, Teacher Management, Admin Management and their shared navigation variants were deliberately excluded under the existing project requirements.

## Reviewed changes

File: https://www.figma.com/design/A2mwI7yuWBhYWAMswSVrjw/Untitled

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
