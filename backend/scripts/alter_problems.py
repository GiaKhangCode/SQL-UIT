from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback to connection string if not found
    DATABASE_URL = "mssql+pyodbc://@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE problems ADD topics NVARCHAR(MAX) NULL, database_type VARCHAR(50) NULL, test_cases NVARCHAR(MAX) NULL"))
        
        # We also need to alter existing 'tables' and 'expected' to allow NULL
        conn.execute(text("ALTER TABLE problems ALTER COLUMN tables NVARCHAR(MAX) NULL"))
        conn.execute(text("ALTER TABLE problems ALTER COLUMN expected NVARCHAR(MAX) NULL"))
        conn.execute(text("ALTER TABLE problems ALTER COLUMN topic VARCHAR(100) NULL"))
        conn.commit()
        print("Columns added and altered successfully in 'problems' table")
    except Exception as e:
        print(f"Error: {e}")
