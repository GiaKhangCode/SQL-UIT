"""Add contest audience and content columns to an existing SQL Server database.

Run after deploying the model update. Safe to rerun; existing contest instructions
are copied into rules only when rules are empty.
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
        columns = (
            ("audience_type", "VARCHAR(20) NOT NULL DEFAULT ('classes')"),
            ("short_description", "NVARCHAR(180) NULL"),
            ("description", "NVARCHAR(MAX) NULL"),
            ("rules", "NVARCHAR(MAX) NULL"),
        )
        for column, definition in columns:
            exists = conn.execute(text("SELECT COL_LENGTH(:table, :column)"),
                                  {"table": object_name, "column": column}).scalar()
            if exists is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] {definition}")
                print(f"Added {object_name}.{column}")
        conn.exec_driver_sql(
            f"UPDATE {table} SET [rules] = CAST([instructions] AS NVARCHAR(MAX)) "
            "WHERE [is_contest] = 1 AND ([rules] IS NULL OR [rules] = '') "
            "AND [instructions] IS NOT NULL"
        )


if __name__ == "__main__":
    main()
