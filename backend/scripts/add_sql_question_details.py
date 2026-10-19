"""Add per-question descriptions and expected outputs; preserve legacy outputs."""
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
        prefix = "[" + schema.replace("]", "]]") + "]."
        table = prefix + "[problem_sql_solutions]"
        for column, definition in [("description", "NVARCHAR(MAX) NOT NULL DEFAULT N''"), ("expected", "NVARCHAR(MAX) NULL")]:
            exists = conn.execute(text("SELECT COL_LENGTH(:table, :column)"), {"table": f"{schema}.problem_sql_solutions", "column": column}).scalar()
            if exists is None:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD [{column}] {definition}")
                print(f"Added problem_sql_solutions.{column}.")
        conn.exec_driver_sql(f"UPDATE s SET s.expected = p.expected FROM {table} s JOIN {prefix}[problems] p ON p.id = s.problem_id WHERE s.order_index = 0 AND s.expected IS NULL AND p.expected IS NOT NULL")


if __name__ == "__main__":
    main()
