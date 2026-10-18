# SQL-UIT Backend

This is the backend for the SQL-UIT application, built with [FastAPI](https://fastapi.tiangolo.com/).

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Python 3.8+**
- **SQL Server** (or SQL Server Express)
- **ODBC Driver 17 for SQL Server** (required by `pyodbc` to connect to SQL Server)

## Installation & Setup

Follow these steps to set up the backend completely:

### 1. Navigate to the backend directory

If you haven't already, open a terminal and navigate to the `backend` folder:

```bash
cd backend
```

### 2. Create and activate a Virtual Environment

It is highly recommended to use a virtual environment to manage dependencies.

**Windows:**

```powershell
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

Install the required Python packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 4. Environment Variables

Create a `.env` file in the root of the `backend` directory by copying the provided example file:
**Windows:**

```powershell
copy .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Open the `.env` file and configure your environment variables:

- **`DATABASE_URL`**: Ensure the connection string matches your SQL Server setup. Replace `@localhost` with your actual SQL Server instance name (e.g., `SQLEXPRESS` or your computer name, like `@DESKTOP-ABC123`). If you are using SQL Authentication instead of Windows Authentication, add your username and password, for example: `mssql+pyodbc://username:password@localhost/SQLUIT?driver=...`
- **`GEMINI_API_KEY`**: Provide your actual Gemini API key for AI features to work.

_(Tip: To find your SQL Server instance name, you can run `SELECT @@SERVERNAME;` in SQL Server Management Studio.)_

### 5. Database Setup & Initialization

We need to create the database and populate it with some initial tables and data.

**Create the database:**
Run the following script to create the `SQLUIT` database on your SQL Server instance. The script will automatically read your `DATABASE_URL` from the `.env` file to connect.

```bash
python scripts/create_db.py
```

**Seed the database:**
Run the seed script. This will automatically create all necessary tables and insert sample data (including demo users and practice problems).

```bash
python scripts/seed.py
```

_This will create two demo accounts you can use to log in:_

- **Student:** `student@demo.local` / `password123`
- **Instructor:** `instructor@demo.local` / `password123`

**Important Note for Existing Users:**
If you have already set up the project previously and recently pulled new code with database changes (e.g., new columns or tables), you might encounter missing column errors. Because this project currently does not use a migration tool (like Alembic), running `scripts/seed.py` only creates _new_ tables but does _not_ modify existing ones.

To update your database to match the new schema, choose one of the following methods:

- **Option 1 (Quickest - Dev Only):** Delete (Drop) the `SQLUIT` database in SQL Server Management Studio, then re-run both `create_db.py` and `seed.py`. (Note: This clears your local data).
- **Option 2 (Manual):** Manually execute `ALTER TABLE ... ADD ...` SQL commands in SQL Server Management Studio to add the newly required columns to your existing tables.

For an existing database-library table, add the editable `.sql` filename columns with:

```bash
python scripts/add_database_library_filenames.py
```

Problem editors also store the reference database script filename. Existing databases should run:

```bash
python scripts/add_problem_schema_file_name.py
```

Assignment problems store their enabled DDL, DML and SQL sections separately from
the reusable problem. Existing databases should run:

```bash
python scripts/add_assignment_workspace_parts.py
```

### 6. Run the Server

Start the FastAPI application using Uvicorn with auto-reload enabled:

```bash
uvicorn app.main:app --reload
```

The server will start running at `http://127.0.0.1:8000`.

### 7. View API Documentation

FastAPI automatically generates interactive API documentation. You can view it by navigating to:

- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Troubleshooting

- **ODBC Driver Error**: If you encounter an error like `[IM002] [Microsoft][ODBC Driver Manager] Data source name not found`, ensure you have installed the **ODBC Driver 17 for SQL Server** from Microsoft's official website.
- **Database Connection Error**: Double check your SQL Server instance name in your `.env` file. You may need to change `localhost` to `SQLEXPRESS` or your specific computer name.


## Exam mode

Before starting an existing SQL Server database, run `python scripts/add_exam_mode.py` from `backend/`. This idempotently adds `assignments.exam_mode` and the `activity_attempts` table. New databases get both through model creation.

Teachers enable **Exam mode** when creating/editing an assignment or contest. Students accept the rules before starting. One server-owned attempt covers every problem in the activity. Drafts, violation IDs and final status survive reloads. Two focus-loss, navigation or external-paste reports finalize all problems; duplicate event IDs do not count twice. Execution and ordinary submission endpoints reject attempts that have not started or are already submitted. The mode cannot be changed after an attempt has started.

`/api/student/activity-attempts/{id}` returns policy/state; `/start`, `/save`, `/violation`, `/submit` update the attempt. Finalization writes each problem's enabled DDL/DML/SQL sections to a submission for **teacher review**; it does not claim that the existing SQL-only grader has evaluated the student's schema or data. Non-exam multi-section work uses `/api/problems/{id}/workspace/submit`.

Browser enforcement is best effort: focus/visibility events cannot identify an application, distinguish intent or guarantee delivery when a browser is killed or offline. Browser-close/reload prompts are native browser dialogs. External paste is approximated by allowing only text copied in the current workspace; it cannot prove clipboard provenance. Pending events and drafts are kept locally and retried after reconnect/reload. This is not a locked-down operating-system exam client.

Checks: `python -m unittest discover -s tests -p test_exam_mode.py`; frontend `npm run test:exam-mode` and `npm run test:workspace-flow`.
