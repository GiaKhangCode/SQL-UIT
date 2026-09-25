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

*(Tip: To find your SQL Server instance name, you can run `SELECT @@SERVERNAME;` in SQL Server Management Studio.)*

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
*This will create two demo accounts you can use to log in:*
- **Student:** `student@demo.local` / `password123`
- **Instructor:** `instructor@demo.local` / `password123`

**Important Note for Existing Users:**
If you have already set up the project previously and recently pulled new code with database changes (e.g., new columns or tables), you might encounter missing column errors. Because this project currently does not use a migration tool (like Alembic), running `scripts/seed.py` only creates *new* tables but does *not* modify existing ones.

To update your database to match the new schema, choose one of the following methods:
- **Option 1 (Quickest - Dev Only):** Delete (Drop) the `SQLUIT` database in SQL Server Management Studio, then re-run both `create_db.py` and `seed.py`. (Note: This clears your local data).
- **Option 2 (Manual):** Manually execute `ALTER TABLE ... ADD ...` SQL commands in SQL Server Management Studio to add the newly required columns to your existing tables.

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
