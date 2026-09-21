import pyodbc

conn_str = (
    r"DRIVER={ODBC Driver 17 for SQL Server};"
    r"SERVER=DESKTOP-DQGF9L4;"
    r"DATABASE=master;"
    r"Trusted_Connection=yes;"
    r"TrustServerCertificate=yes;"
)

try:
    print("Connecting to SQL Server...")
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    cursor.execute("SELECT database_id FROM sys.databases WHERE Name = 'SQLUIT'")
    exists = cursor.fetchone()
    
    if not exists:
        print("Database 'SQLUIT' not found, creating it now...")
        cursor.execute("CREATE DATABASE SQLUIT")
        print("Database 'SQLUIT' created successfully!")
    else:
        print("Database 'SQLUIT' already exists.")
        
    conn.close()
    
except Exception as e:
    print(f"Error connecting or creating Database: {e}")
