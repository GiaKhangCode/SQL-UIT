"""Add SQL solution storage without changing existing problem rows."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import engine
from app.models import ProblemSqlSolution

if __name__ == "__main__":
    ProblemSqlSolution.__table__.create(bind=engine, checkfirst=True)
    print("SQL solution storage is ready.")
