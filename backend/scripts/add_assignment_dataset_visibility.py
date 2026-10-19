"""Add per-activity dataset visibility overrides."""
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
        table = "[" + schema.replace("]", "]]") + "].[assignment_problems]"
        exists = conn.execute(text("SELECT COL_LENGTH(:table, :column)"), {"table": f"{schema}.assignment_problems", "column": "dataset_visibility"}).scalar()
        if exists is None:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [dataset_visibility] NVARCHAR(MAX) NOT NULL DEFAULT N'{{}}'")
            print("Added assignment_problems.dataset_visibility.")
        else:
            print("assignment_problems.dataset_visibility already exists.")


if __name__ == "__main__":
    main()
