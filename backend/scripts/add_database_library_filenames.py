"""Add editable SQL filenames to saved lecturer database-library entries."""
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
        for column in ("database_file_name", "create_table_file_name", "insert_into_file_name"):
            exists = conn.execute(
                text("SELECT COL_LENGTH(:table, :column)"),
                {"table": f"{schema}.database_library_entries", "column": column},
            ).scalar()
            if exists is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] NVARCHAR(255) NULL")
                print(f"Added database_library_entries.{column}.")
            else:
                print(f"database_library_entries.{column} already exists.")


if __name__ == "__main__":
    main()
