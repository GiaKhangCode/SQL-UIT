from sqlalchemy import create_engine, text

DATABASE_URL = "mssql+pyodbc://@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    try:
        # Add creator_id to problems
        query = text("""
            ALTER TABLE problems ADD creator_id VARCHAR(50) NULL
        """)
        conn.execute(query)
        conn.commit()
        print("Columns added successfully")
    except Exception as e:
        print(f"Error: {e}")
