"""Add score visibility and submission limits without changing existing activities."""
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
        table = f"[{schema.replace(']', ']]')}].[assignments]"
        for name, definition in [
            ("show_scores_after_submit", "BIT NOT NULL CONSTRAINT df_assignments_show_scores DEFAULT 1"),
            ("max_submissions", "INT NULL"),
        ]:
            if conn.execute(text("SELECT COL_LENGTH(:table, :column)"),
                            {"table": f"{schema}.assignments", "column": name}).scalar() is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{name}] {definition}")
    print("Submission policy schema is ready.")


if __name__ == "__main__": main()
