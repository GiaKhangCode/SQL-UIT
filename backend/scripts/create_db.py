import os
import pyodbc
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

# Load environment variables
load_dotenv()
database_url = os.getenv("DATABASE_URL")

if not database_url:
    print("Error: DATABASE_URL not found in .env file.")
    exit(1)

# Parse the database URL to get connection details
url = make_url(database_url)
server = url.host
db_name = url.database

# Construct connection string to connect to 'master' DB to create the new DB
conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE=master;"

if url.username and url.password:
    conn_str += f"UID={url.username};PWD={url.password};"
else:
    conn_str += "Trusted_Connection=yes;"

conn_str += "TrustServerCertificate=yes;"

try:
    print(f"Connecting to SQL Server at {server}...")
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    cursor.execute(f"SELECT database_id FROM sys.databases WHERE Name = '{db_name}'")
    exists = cursor.fetchone()
    
    if not exists:
        print(f"Database '{db_name}' not found, creating it now...")
        cursor.execute(f"CREATE DATABASE {db_name}")
        print(f"Database '{db_name}' created successfully!")
    else:
        print(f"Database '{db_name}' already exists.")
        
    conn.close()
    
except Exception as e:
    print(f"Error connecting or creating Database: {e}")
