import datetime
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import (
    Assignment, AssignmentClass, AssignmentProblem, Base, Class,
    ClassEnrollment, Problem, Submission, User,
)
from app.routers.assignments import create_assignment, get_assignments, validate_assignment_classes
from app.routers.problems import submit_query
from app.routers.student_assignments import get_student_assignments
from app.schemas import AssignmentCreate, ClassCreate, QueryRequest


class AssignmentIndependenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.teacher = User(id="teacher", email="teacher@example.test", hashed_password="x",
                            name="Teacher", initials="T", role="instructor")
        self.students = [
            User(id=f"student-{n}", email=f"student-{n}@example.test", hashed_password="x",
                 name=f"Student {n}", initials=f"S{n}", role="student")
            for n in range(1, 4)
        ]
        self.db.add_all([self.teacher, *self.students])
        self.db.add_all([
            Class(id="A", course="SQL A", term="Fall", instructor_id="teacher"),
            Class(id="B", course="SQL B", term="Fall", instructor_id="teacher"),
            Class(id="C", course="Other", term="Fall", instructor_id="other"),
        ])
        self.db.add_all([
            ClassEnrollment(class_id="A", student_id="student-1"),
            ClassEnrollment(class_id="B", student_id="student-1"),
            ClassEnrollment(class_id="B", student_id="student-2"),
            ClassEnrollment(class_id="C", student_id="student-3"),
        ])
        self.db.add_all([
            Problem(id="P1", number="1", title="Query one", topic="SELECT", difficulty="Easy",
                    description="", requirements="", practice_listed=True),
            Problem(id="P2", number="2", title="Query two", topic="JOIN", difficulty="Easy",
                    description="", requirements="", practice_listed=True),
        ])
        now = datetime.datetime.utcnow()
        for activity_id, class_ids in (("A1", ("A", "B")), ("A2", ("A",))):
            self.db.add(Assignment(id=activity_id, title=activity_id, published=True,
                                   is_contest=False, instructor_id="teacher",
                                   opens=now - datetime.timedelta(days=1),
                                   closes=now + datetime.timedelta(days=1)))
            self.db.add(AssignmentProblem(id=f"{activity_id}-P1", assignment_id=activity_id,
                                          problem_id="P1", points=20))
            self.db.add_all(AssignmentClass(id=f"{activity_id}-{class_id}",
                                            assignment_id=activity_id, class_id=class_id)
                            for class_id in class_ids)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_contract_has_no_work_mode(self):
        self.assertNotIn("format", Assignment.__table__.columns)
        self.assertNotIn("mode", Class.__table__.columns)
        body = {
            "title": "Lab", "classIds": ["A", "B"], "instructions": "Solve both",
            "opens": "2026-09-01T00:00:00", "closes": "2026-09-02T00:00:00",
            "problems": [{"id": "P1", "points": 20}],
            "studentOptions": {"hints": True, "comments": True,
                               "leaderboard": False, "aiAllowed": True},
            "published": True,
        }
        payload = AssignmentCreate.model_validate(body)
        with self.assertRaises(ValidationError):
            AssignmentCreate.model_validate({**body, "format": "Individual"})
        with self.assertRaises(ValidationError):
            ClassCreate.model_validate({"id": "D", "course": "SQL", "term": "Fall", "mode": "Group work"})
        self.assertNotIn("format", payload.model_dump())
        validate_assignment_classes(payload, self.db, self.teacher)
        created = create_assignment(payload, db=self.db, current_user=self.teacher)
        self.assertEqual(set(created["classIds"]), {"A", "B"})
        self.assertNotIn("format", created)
        with self.assertRaises(HTTPException):
            validate_assignment_classes(payload.model_copy(update={"class_ids": ["C"]}),
                                        self.db, self.teacher)

    def test_multi_class_delivery_and_progress_are_per_student_and_assignment(self):
        self.db.add_all([
            Submission(id="S1", user_id="student-1", problem_id="P1", source="Assignments",
                       context="A1", result="Accepted", score=20),
            Submission(id="S2", user_id="student-2", problem_id="P1", source="Assignments",
                       context="A1", result="Wrong Answer", score=0),
        ])
        self.db.commit()
        first = get_student_assignments(db=self.db, current_user=self.students[0])
        second = get_student_assignments(db=self.db, current_user=self.students[1])
        third = get_student_assignments(db=self.db, current_user=self.students[2])
        first_activities = {item["id"]: item for item in first["assignments"]}
        second_activities = {item["id"]: item for item in second["assignments"]}
        self.assertEqual(set(first_activities["A1"]["classIds"]), {"A", "B"})
        self.assertIn("instructions", first_activities["A1"])
        self.assertEqual(first_activities["A1"]["problemProgress"]["P1"], "Solved")
        self.assertEqual(first_activities["A2"]["problemProgress"]["P1"], "Not started")
        self.assertEqual(second_activities["A1"]["classIds"], ["B"])
        self.assertEqual(second_activities["A1"]["problemProgress"]["P1"], "In progress")
        self.assertEqual(third["assignments"], [])
        self.assertNotIn("groups", first)
        self.assertNotIn("groupId", first_activities["A1"])
        teacher_view = {item["id"]: item for item in get_assignments(db=self.db, current_user=self.teacher)}
        self.assertEqual(teacher_view["A1"]["submitted"], "2/2")
        self.assertNotIn("format", teacher_view["A1"])

    def test_submission_requires_an_assigned_activity_and_stays_with_student(self):
        request = QueryRequest(query="SELECT 1", source="Assignments", context="A1")
        with patch("app.routers.problems.run_sandbox", return_value={"status": "Accepted", "passed": 1, "total": 1}):
            submit_query("P1", request, db=self.db, current_user=self.students[0])
        submission = self.db.query(Submission).one()
        self.assertEqual((submission.user_id, submission.context, submission.score),
                         ("student-1", "A1", 20))
        for student, context, source, problem, expected in (
            (self.students[2], "A1", "Assignments", "P1", 403),
            (self.students[1], "A2", "Assignments", "P1", 403),
            (self.students[0], "missing", "Assignments", "P1", 404),
            (self.students[0], "A1", "Contests", "P1", 404),
            (self.students[0], "A1", "Assignments", "P2", 403),
        ):
            with self.subTest(student=student.id, context=context, source=source, problem=problem):
                with self.assertRaises(HTTPException) as caught:
                    submit_query(problem, QueryRequest(query="SELECT 1", source=source, context=context),
                                 db=self.db, current_user=student)
                self.assertEqual(caught.exception.status_code, expected)
        self.assertEqual(self.db.query(Submission).count(), 1)


if __name__ == "__main__":
    unittest.main()
