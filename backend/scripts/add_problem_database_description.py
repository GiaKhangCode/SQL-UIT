"""Add relation descriptions and their student visibility setting (SQL Server)."""
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
        table = "[" + schema.replace("]", "]]") + "].[problems]"
        for column, definition in [
            ("database_description", "NVARCHAR(MAX) NOT NULL DEFAULT N'[]'"),
            ("database_description_visible", "BIT NOT NULL DEFAULT 1"),
        ]:
            exists = conn.execute(text("SELECT COL_LENGTH(:table, :column)"), {"table": f"{schema}.problems", "column": column}).scalar()
            if exists is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] {definition}")
                print(f"Added problems.{column}.")
            else:
                print(f"problems.{column} already exists.")


if __name__ == "__main__":
    main()
