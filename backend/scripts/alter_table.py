from sqlalchemy import create_engine, text

DATABASE_URL = "mssql+pyodbc://@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE classes ADD start_date VARCHAR(50) NULL, end_date VARCHAR(50) NULL"))
        conn.commit()
        print("Columns added successfully")
    except Exception as e:
        print(f"Error: {e}")
