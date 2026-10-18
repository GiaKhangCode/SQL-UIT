"""Add support for multiple seed datasets in lecturer database-library entries."""
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
        escaped_schema = schema.replace("]", "]]")
        table = f"[{escaped_schema}].[database_library_entries]"
        exists = conn.execute(
            text("SELECT COL_LENGTH(:table, :column)"),
            {"table": f"{schema}.database_library_entries", "column": "datasets_json"},
        ).scalar()
        if exists is None:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [datasets_json] NVARCHAR(MAX) NULL")
            print("Added database_library_entries.datasets_json.")
        else:
            print("database_library_entries.datasets_json already exists.")


if __name__ == "__main__":
    main()
