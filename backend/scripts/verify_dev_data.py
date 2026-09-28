"""Check the reusable local fixture and run every seeded reference solution.

Run from backend: ..\\.venv\\Scripts\\python.exe -m scripts.verify_dev_data
"""

from collections import Counter

from sqlalchemy import text

from app.database import SessionLocal
from app.models import (
    ActivityLog, Assignment, AssignmentClass, AssignmentProblem, Class,
    ClassEnrollment, Problem, Submission, User,
)
from app.services.sandbox import run_sandbox
from scripts.seed_dev_data import PROBLEMS


def verify():
    db = SessionLocal()
    try:
        database, server = db.execute(text("SELECT DB_NAME(), @@SERVERNAME")).one()
        assert database.upper() == "SQLUIT" and "LOCALDB" in server.upper()

        students = db.query(User).filter(User.email.like("student%@demo.local")).all()
        assert len(students) == 8
        assert db.query(User).filter(User.status == "Pending", User.role == "instructor").count() >= 1
        assert db.query(User).filter(User.status == "Inactive").count() >= 1
        assert db.query(User).filter(User.email == "instructor@demo.local").one().name == "Giảng Viên"
        assert db.query(User).filter(User.email == "admin@demo.local").one().name == "Quản Trị Viên"

        rosters = {class_id: {row.student_id for row in db.query(ClassEnrollment).filter_by(class_id=class_id)}
                   for class_id in ("IS207.R11", "IS201.R12", "IS207.R99")}
        assert [len(rosters[key]) for key in rosters] == [6, 6, 2]
        assert rosters["IS207.R11"] != rosters["IS201.R12"]
        assert db.get(Class, "IS207.R99").instructor_id is None

        problems = {p.id: p for p in db.query(Problem).filter(Problem.id.like("dev-%"))}
        assert len(problems) == len(PROBLEMS) == 10
        assert sum(bool(p.practice_listed) for p in problems.values()) == 7
        for spec in PROBLEMS:
            result = run_sandbox(db, problems[spec["id"]], spec["solution"], is_submit=True)
            assert result["status"] == "Accepted", (spec["id"], result)

        activities = db.query(Assignment).filter(Assignment.id.like("dev-%")).all()
        assert Counter(a.is_contest for a in activities) == {False: 4, True: 3}
        now = __import__("datetime").datetime.utcnow()
        assert not db.get(Assignment, "dev-assignment-draft").published
        assert db.get(Assignment, "dev-assignment-scheduled").opens > now
        assert db.get(Assignment, "dev-assignment-open").opens < now < db.get(Assignment, "dev-assignment-open").closes
        assert db.get(Assignment, "dev-assignment-closed").closes < now
        for activity in activities:
            links = db.query(AssignmentClass).filter_by(assignment_id=activity.id).all()
            items = db.query(AssignmentProblem).filter_by(assignment_id=activity.id).order_by(AssignmentProblem.order_index).all()
            assert links and items
            assert [item.order_index for item in items] == list(range(len(items)))
            assert all(db.get(Class, link.class_id) for link in links)
            assert all(db.get(Problem, item.problem_id) and item.points > 0 for item in items)

        submissions = db.query(Submission).filter(Submission.id.like("dev-sub-%")).all()
        assert len(submissions) == 12
        assert {s.result for s in submissions} >= {"Accepted", "Wrong Answer", "Runtime Error"}
        assert any(s.evaluated_score is not None and s.feedback for s in submissions)
        assert all(db.get(User, s.user_id) and db.get(Problem, s.problem_id) for s in submissions)
        assert db.query(ActivityLog).filter(ActivityLog.id.like("dev-log-%")).count() == 5
        print("PASS: 8 students, 3 classes, 10 executable problems, 4 assignments, 3 contests, 12 submissions, 5 activity logs; relationships and lifecycle valid.")
    finally:
        db.rollback()  # sandbox temp tables and any read transaction
        db.close()


if __name__ == "__main__":
    verify()
