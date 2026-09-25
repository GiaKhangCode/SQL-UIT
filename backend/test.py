import os
from sqlalchemy import create_engine
import json
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL")

engine = create_engine(database_url)
with engine.connect() as conn:
    result = conn.execute(engine.execute).fetchall() if hasattr(engine, 'execute') else conn.execute(__import__('sqlalchemy').text('SELECT id, number, title, practice_listed FROM problems')).fetchall()
    print([dict(r._mapping) for r in result])
