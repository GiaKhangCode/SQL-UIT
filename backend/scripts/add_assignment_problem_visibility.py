"""Add independent statement/schema visibility to each activity problem."""
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
        for column in ("database_structure_visible", "database_description_visible"):
            exists = conn.execute(text("SELECT COL_LENGTH(:table, :column)"), {"table": f"{schema}.assignment_problems", "column": column}).scalar()
            if exists is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] BIT NOT NULL DEFAULT 1")
                print(f"Added assignment_problems.{column}.")
            else:
                print(f"assignment_problems.{column} already exists.")


if __name__ == "__main__":
    main()
