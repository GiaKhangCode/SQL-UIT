"""Add per-problem workspace sections to existing SQL Server assignments."""
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
        exists = conn.execute(
            text("SELECT COL_LENGTH(:table, 'workspace_parts')"),
            {"table": f"{schema}.assignment_problems"},
        ).scalar()
        table = f"[{schema.replace(']', ']]')}].[assignment_problems]"
        if exists is None:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [workspace_parts] NVARCHAR(MAX) NULL")
            print("Added assignment_problems.workspace_parts.")
        else:
            print("assignment_problems.workspace_parts already exists.")
        assignment_table = f"[{schema.replace(']', ']]')}].[assignments]"
        problem_table = f"[{schema.replace(']', ']]')}].[problems]"
        result = conn.exec_driver_sql(f"""
            UPDATE ap
            SET [workspace_parts] = COALESCE(p.[workspace_parts], N'["SQL"]')
            FROM {table} AS ap
            JOIN {assignment_table} AS a ON a.[id] = ap.[assignment_id]
            JOIN {problem_table} AS p ON p.[id] = ap.[problem_id]
            WHERE ap.[workspace_parts] IS NULL AND a.[is_contest] = 0
        """)
        print(f"Preserved existing practice sections for {result.rowcount} assignment problems.")


if __name__ == "__main__":
    main()
