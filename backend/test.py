
from sqlalchemy import create_engine
import json
engine = create_engine('mssql+pyodbc://@DESKTOP-DQGF9L4/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes')
with engine.connect() as conn:
    result = conn.execute(engine.execute).fetchall() if hasattr(engine, 'execute') else conn.execute(__import__('sqlalchemy').text('SELECT id, number, title, practice_listed FROM problems')).fetchall()
    print([dict(r._mapping) for r in result])

