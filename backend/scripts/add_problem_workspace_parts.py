"""Run once before starting the updated API: python scripts/add_problem_workspace_parts.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import engine


def main():
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration is for SQL Server only.")
    with engine.begin() as conn:
        schema = conn.dialect.default_schema_name or "dbo"
        exists = conn.execute(text("SELECT COL_LENGTH(:table, 'workspace_parts')"), {"table": f"{schema}.problems"}).scalar()
        if exists is None:
            table = "[" + schema.replace("]", "]]") + "].[problems]"
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [workspace_parts] NVARCHAR(MAX) NOT NULL DEFAULT ('[\"SQL\"]')")
            print("Added problems.workspace_parts; existing problems default to SQL.")
        else:
            print("problems.workspace_parts already exists.")


if __name__ == "__main__":
    main()
