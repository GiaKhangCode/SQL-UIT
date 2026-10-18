# iSQL Frontend

A modern React frontend for the iSQL application, built with Vite, TypeScript, React Router, and CodeMirror.

## Prerequisites

Before running the frontend, ensure you have:

- **Node.js 18+** installed
- **npm** (comes with Node.js)
- The **SQL-UIT Backend** running on `http://127.0.0.1:8000` (see the backend README for instructions).

## Installation & Setup

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

Vite will start the development server, usually at `http://127.0.0.1:5174/`.

### API Connection (Proxy)

You do **not** need to configure `.env` variables for the API URL in development.
The project uses Vite's proxy feature (configured in `vite.config.ts`) to automatically forward all requests starting with `/api` to `http://127.0.0.1:8000`. This avoids CORS issues and simplifies local development.

## Project Structure & Architecture

Unlike the initial mockup phase, this frontend is **fully integrated with the live FastAPI backend**.

- **API Client (`src/services/apiClient.ts`)**: Handles all HTTP requests, automatically attaching the JWT `Authorization` header if a user is logged in.
- **Authentication (`src/services/authService.ts`)**: Connects to the real backend login/registration endpoints. The JWT token is securely saved in `localStorage`.
- **Student API (`src/services/studentApi.ts`)**: Handles fetching problems, submitting SQL queries for grading, and retrieving dashboard statistics.
- **Teacher API (`src/services/teacherService.ts`)**: Handles instructor-facing features like reviewing submissions, managing classes, and creating assignments.
- **Admin API (`src/services/adminService.ts`)**: Handles platform-wide management features.

## Available Scripts

- `npm run dev`: Starts the local development server.
- `npm run build`: Compiles TypeScript and builds the production bundle into the `dist/` folder.
- `npm run test`: Runs TypeScript type-checking (`tsc --noEmit`).

## Testing the Application

Once both the backend and frontend are running, you can log in using the demo accounts created by the backend's seed script:

- **Student:** `student@demo.local` / `password123`
- **Instructor:** `instructor@demo.local` / `password123`
- **Admin:** `admin@demo.local` / `123`

### Comprehensive contest workspace

The student exam page is available at `/contests/:contestId/exam` for contests
whose `examType` is `comprehensive`. The contest details page shows a
“Enter exam” button while the contest is live. Classic contests keep using
the existing problem workspace.

The workspace includes DDL execution, schema inspection/diagram, DML seeding,
SQL queries, local draft recovery and the submission scorecard. It requires a
backend with the comprehensive exam API from the original SQL-UIT project:

- `POST /api/contests/{contestId}/setup-db`
- `POST /api/contests/{contestId}/run-ddl`
- `POST /api/contests/{contestId}/seed-dml`
- `GET /api/contests/{contestId}/schema-inspector`
- `POST /api/contests/{contestId}/run-query`
- `POST /api/contests/{contestId}/submit-exam`

The assignment response must include `examType`, `ddlPoints`, `dmlPoints`,
`sqlPoints`, `dmlSeedScript` and question descriptions in `problemDetails`.
The backend in this checkout does not yet implement these endpoints; use the
original SQL-UIT backend on the configured API target to run comprehensive exams.

### Assignment workspace sections (DDL / DML / SQL)

Each problem in an assignment can enable DDL, DML and SQL independently. New
problems in an assignment start with all three sections enabled. Existing problem
workspace settings remain in effect for Practice and Contests.

Before using this with an existing SQL Server database, run
`python scripts/add_assignment_workspace_parts.py` from `backend/`. The new
assignment-problem setting is stored separately from the reusable problem.

### SQL Solution checks

Teachers can rename or disable the single SQL Solution. Run executes it on every
dataset and reports SQL execution/fetch time, excluding database setup and network
latency. Student time limits are configurable (100–60,000 ms, default 5,000).
SQL-only submissions contain one SELECT query; Accepted requires it to pass every
dataset. Staged workspace SQL runs apply the same student limit. Disabling the
solution excludes it from grading until it is enabled again.

The backend creates `problem_sql_solutions` on startup. For an API without reload,
restart it or run `python scripts/add_sql_solutions.py` from `backend/` before using
the new editor. Existing single-query problems retain their previous behavior.
