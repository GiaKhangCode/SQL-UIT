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
Create a `.env` file in the root of the `backend` directory. You can use the following template (make sure to replace the `DATABASE_URL` and `GEMINI_API_KEY` with your actual values):

```env
# Database Connection String
# Update '@localhost' or 'DESKTOP-DQGF9L4' with your SQL Server instance name if needed.
DATABASE_URL="mssql+pyodbc://@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes"

# JWT Auth Configuration
SECRET_KEY="your-super-secret-jwt-key"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES="1440"

# Gemini API Key (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 5. Database Setup & Initialization
We need to create the database and populate it with some initial tables and data.

**Create the database:**
Run the following script to create the `SQLUIT` database on your SQL Server instance.
*(Note: Ensure your SQL Server is running. If this script fails, you may need to edit the connection string inside `scripts/create_db.py` to match your local server name.)*
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
- **Database Connection Error**: Double check your SQL Server instance name in your `.env` file and `scripts/create_db.py`. You may need to change `localhost` to `SQLEXPRESS` or your specific computer name.
