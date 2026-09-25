import sys
import os
import pyodbc

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from app.models import Assignment, AssignmentClass, AssignmentProblem

def create_tables():
    print("Creating Assignment tables...")
    Assignment.__table__.create(engine, checkfirst=True)
    AssignmentClass.__table__.create(engine, checkfirst=True)
    AssignmentProblem.__table__.create(engine, checkfirst=True)
    print("Assignment tables created successfully.")

if __name__ == "__main__":
    create_tables()
