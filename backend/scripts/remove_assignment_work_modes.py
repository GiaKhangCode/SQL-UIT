"""Remove the obsolete assignment and class work-mode columns from SQL Server.

Run once against an existing database after deploying the updated models. The
script is safe to rerun and does not change assignments, enrollments, or submissions.
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import engine


def drop_column(conn, table: str, column: str) -> None:
    schema = conn.dialect.default_schema_name or "dbo"
    object_name = f"{schema}.{table}"
    table_name = f"[{schema.replace(']', ']]')}].[{table}]"
    if conn.execute(text("SELECT COL_LENGTH(:table, :column)"), {"table": object_name, "column": column}).scalar() is None:
        print(f"{object_name}.{column}: already absent")
        return

    constraint = conn.execute(text("""
        SELECT dc.name
        FROM sys.default_constraints AS dc
        JOIN sys.columns AS c
          ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(:table) AND c.name = :column
    """), {"table": object_name, "column": column}).scalar()
    if constraint:
        escaped_constraint = constraint.replace("]", "]]")
        conn.exec_driver_sql(f"ALTER TABLE {table_name} DROP CONSTRAINT [{escaped_constraint}]")
    conn.exec_driver_sql(f"ALTER TABLE {table_name} DROP COLUMN [{column}]")
    print(f"{object_name}.{column}: removed")


def main() -> None:
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration is for the SQL Server database used by this project.")
    with engine.begin() as conn:
        drop_column(conn, "assignments", "format")
        drop_column(conn, "classes", "mode")


if __name__ == "__main__":
    main()
