"""Add a saved filename for the problem's reference database script."""
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
        table = f"[{escaped_schema}].[problems]"
        exists = conn.execute(
            text("SELECT COL_LENGTH(:table, :column)"),
            {"table": f"{schema}.problems", "column": "schema_file_name"},
        ).scalar()
        if exists is None:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [schema_file_name] NVARCHAR(255) NULL")
            print("Added problems.schema_file_name.")
        else:
            print("problems.schema_file_name already exists.")


if __name__ == "__main__":
    main()
