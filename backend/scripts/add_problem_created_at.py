"""Track creation dates for new problems; leave unknown historical dates empty."""
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
        if conn.execute(text("SELECT COL_LENGTH(:table, 'created_at')"),
                        {"table": f"{schema}.problems"}).scalar() is None:
            table = f"[{schema.replace(']', ']]')}].[problems]"
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD [created_at] DATETIME NULL")
    print("Problem creation date schema is ready.")


if __name__ == "__main__":
    main()
