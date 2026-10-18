"""Idempotent SQL Server migration for exam policy and activity attempts."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import engine
from app.models import ActivityAttempt


def main():
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration is for SQL Server only.")
    with engine.begin() as conn:
        schema = conn.dialect.default_schema_name or "dbo"
        exists = conn.execute(text("SELECT COL_LENGTH(:table, 'exam_mode')"),
                              {"table": f"{schema}.assignments"}).scalar()
        if exists is None:
            table = f"[{schema.replace(']', ']]')}].[assignments]"
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [exam_mode] BIT NOT NULL CONSTRAINT [df_assignments_exam_mode] DEFAULT 0")
    ActivityAttempt.__table__.create(engine, checkfirst=True)
    print("Exam mode schema is ready.")


if __name__ == "__main__":
    main()
