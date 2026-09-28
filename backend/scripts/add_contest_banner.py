"""Add optional contest banner references to an existing SQL Server database.

Safe to rerun. New databases receive these columns from SQLAlchemy create_all.
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import engine


def main() -> None:
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration is for SQL Server only.")
    with engine.begin() as conn:
        schema = conn.dialect.default_schema_name or "dbo"
        table = f"[{schema.replace(']', ']]')}].[assignments]"
        object_name = f"{schema}.assignments"
        for column, definition in (
            ("banner_url", "VARCHAR(255) NULL"),
            ("banner_source_url", "VARCHAR(255) NULL"),
            ("banner_crop", "VARCHAR(160) NULL"),
        ):
            if conn.execute(text("SELECT COL_LENGTH(:table, :column)"),
                            {"table": object_name, "column": column}).scalar() is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] {definition}")
                print(f"Added {object_name}.{column}")


if __name__ == "__main__":
    main()
