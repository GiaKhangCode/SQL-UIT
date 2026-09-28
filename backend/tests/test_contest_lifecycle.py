import datetime
import asyncio
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi import UploadFile
from starlette.datastructures import Headers
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Assignment, Base, Class, ClassEnrollment, Problem, Submission, User
from app.routers.assignments import create_assignment, get_assignment, get_assignments, get_audience_count, update_assignment, upload_contest_banner
from app.routers.problems import get_problem, run_query, submit_query
from app.routers.student_assignments import get_student_assignments
from app.schemas import AssignmentCreate, QueryRequest


class ContestLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.teacher = User(id="teacher", email="teacher@sample.test", hashed_password="x",
                            name="Teacher", initials="T", role="instructor", status="Active")
        self.enrolled = User(id="enrolled", email="enrolled@sample.test", hashed_password="x",
                             name="Enrolled", initials="E", role="student", status="Active")
        self.other = User(id="other", email="other@sample.test", hashed_password="x",
                          name="Other", initials="O", role="student", status="Active")
        self.inactive = User(id="inactive", email="inactive@sample.test", hashed_password="x",
                             name="Inactive", initials="I", role="student", status="Inactive")
        self.db.add_all([self.teacher, self.enrolled, self.other, self.inactive,
                         Class(id="C", course="SQL", term="Fall", instructor_id="teacher", status="Active"),
                         ClassEnrollment(class_id="C", student_id="enrolled"),
                         Problem(id="P", number="1", title="SQL query", topic="SELECT", difficulty="Easy",
                                 description="Query the table", requirements="Return one row", hint="Use SELECT", practice_listed=False)])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def payload(self, audience="classes", class_ids=None, start_hours=-1, end_hours=1):
        now = datetime.datetime.utcnow()
        return AssignmentCreate.model_validate({
            "title": "SQL Sprint", "isContest": True, "audienceType": audience,
            "classIds": ["C"] if class_ids is None and audience == "classes" else class_ids or [],
            "shortDescription": "A short SQL event", "description": "## About\nSolve SQL challenges.",
            "rules": "Best score per problem; submissions close at the end.",
            "opens": (now + datetime.timedelta(hours=start_hours)).isoformat(),
            "closes": (now + datetime.timedelta(hours=end_hours)).isoformat(),
            "problems": [{"id": "P", "points": 30}],
            "studentOptions": {"leaderboard": True, "aiAllowed": False}, "published": True,
        })

    def test_audience_contract_and_creation(self):
        with self.assertRaises(ValidationError):
            self.payload("all_students", ["C"])
        with self.assertRaises(ValidationError):
            AssignmentCreate.model_validate({**self.payload("all_students").model_dump(by_alias=True), "isContest": False})

    def test_banner_upload_and_student_contract(self):
        webp = b"RIFF" + (16).to_bytes(4, "little") + b"WEBPVP8 " + (4).to_bytes(4, "little") + b"\0\0\0\0"
        def upload(data, content_type="image/webp"):
            return UploadFile(file=BytesIO(data), filename="banner.webp", headers=Headers({"content-type": content_type}))
        with TemporaryDirectory() as directory, patch("app.routers.assignments.BANNER_DIR", new=Path(directory)):
            with self.assertRaises(HTTPException):
                asyncio.run(upload_contest_banner(upload(webp), upload(webp), current_user=self.enrolled))
            with self.assertRaises(HTTPException):
                asyncio.run(upload_contest_banner(upload(b"not an image"), upload(webp), current_user=self.teacher))
            urls = asyncio.run(upload_contest_banner(upload(webp), upload(webp), current_user=self.teacher))
            payload = self.payload()
            payload.banner_url = urls["bannerUrl"]
            payload.banner_source_url = urls["bannerSourceUrl"]
            payload.banner_crop = '{"x":0.5,"y":0.5,"zoom":1}'
            payload.published = False
            activity = create_assignment(payload, db=self.db, current_user=self.teacher)
            self.assertEqual(activity["bannerUrl"], urls["bannerUrl"])
            self.assertEqual(get_assignment(activity["id"], db=self.db, current_user=self.teacher)["bannerSourceUrl"], urls["bannerSourceUrl"])
            payload.published = True
            update_assignment(activity["id"], payload, db=self.db, current_user=self.teacher)
            student = next(item for item in get_student_assignments(db=self.db, current_user=self.enrolled)["assignments"]
                           if item["id"] == activity["id"])
            self.assertEqual(student["bannerUrl"], urls["bannerUrl"])
            self.assertIsNone(get_assignment(activity["id"], db=self.db, current_user=self.enrolled)["bannerSourceUrl"])
            payload.banner_url = None
            payload.banner_source_url = None
            payload.banner_crop = None
            update_assignment(activity["id"], payload, db=self.db, current_user=self.teacher)
            student = next(item for item in get_student_assignments(db=self.db, current_user=self.enrolled)["assignments"]
                           if item["id"] == activity["id"])
            self.assertIsNone(student["bannerUrl"])

    def test_class_and_all_student_contests_have_distinct_audiences(self):
        self.assertEqual(get_audience_count("classes", ["C"], self.db, self.teacher)["eligibleStudents"], 1)
        self.assertEqual(get_audience_count("all_students", [], self.db, self.teacher)["eligibleStudents"], 2)
        class_activity = create_assignment(self.payload(), db=self.db, current_user=self.teacher)
        open_activity = create_assignment(self.payload("all_students"), db=self.db, current_user=self.teacher)
        self.assertEqual(class_activity["eligibleStudents"], 1)
        self.assertEqual(open_activity["eligibleStudents"], 2)
        self.assertEqual(open_activity["classes"], "All students")
        self.assertEqual(open_activity["classIds"], [])
        self.assertEqual(self.db.get(Assignment, open_activity["id"]).audience_type, "all_students")
        for student, expected in ((self.enrolled, 2), (self.other, 1)):
            activities = [a for a in get_student_assignments(db=self.db, current_user=student)["assignments"] if a["isContest"]]
            self.assertEqual(len(activities), expected)
        teacher_rows = [a for a in get_assignments(db=self.db, current_user=self.teacher) if a["isContest"]]
        self.assertEqual({row["submitted"] for row in teacher_rows}, {"0/1", "0/2"})

    def test_upcoming_hides_problems_and_rejects_access(self):
        activity = create_assignment(self.payload("all_students", start_hours=2, end_hours=3),
                                     db=self.db, current_user=self.teacher)
        contest = next(a for a in get_student_assignments(db=self.db, current_user=self.other)["assignments"]
                       if a["id"] == activity["id"])
        self.assertEqual(contest["contestStatus"], "Upcoming")
        self.assertEqual(contest["problemCount"], 1)
        self.assertEqual(contest["problemIds"], [])
        self.assertEqual(contest["problemDetails"], [])
        self.assertEqual(contest["problemProgress"], {})
        self.assertEqual(get_assignment(activity["id"], db=self.db, current_user=self.other)["problemList"], [])
        for action in (
            lambda: get_problem("P", context=activity["id"], db=self.db, current_user=self.other),
            lambda: run_query("P", QueryRequest(query="SELECT 1", source="Contests", context=activity["id"]), db=self.db, current_user=self.other),
            lambda: submit_query("P", QueryRequest(query="SELECT 1", source="Contests", context=activity["id"]), db=self.db, current_user=self.other),
        ):
            with self.assertRaises(HTTPException) as caught:
                action()
            self.assertEqual(caught.exception.status_code, 403)

    def test_live_submission_and_closed_review(self):
        activity = create_assignment(self.payload("all_students"), db=self.db, current_user=self.teacher)
        context = activity["id"]
        detail = get_problem("P", context=context, db=self.db, current_user=self.other)
        self.assertIsNone(detail.hint)
        request = QueryRequest(query="SELECT 1", source="Contests", context=context)
        with patch("app.routers.problems.run_sandbox", return_value={"status": "Accepted", "passed": 1, "total": 1}):
            run_query("P", request, db=self.db, current_user=self.other)
            submit_query("P", request, db=self.db, current_user=self.other)
        self.assertEqual(self.db.query(Submission).one().user_id, "other")
        contest = next(a for a in get_student_assignments(db=self.db, current_user=self.other)["assignments"] if a["id"] == context)
        self.assertEqual((contest["contestStatus"], contest["score"], contest["rank"]), ("Live", 30, 1))
        self.assertEqual(contest["submitters"], 1)
        self.db.get(Assignment, context).closes = datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
        self.db.commit()
        closed = next(a for a in get_student_assignments(db=self.db, current_user=self.other)["assignments"] if a["id"] == context)
        self.assertEqual(closed["contestStatus"], "Closed")
        self.assertEqual(closed["problemIds"], ["P"])
        self.assertEqual(get_problem("P", context=context, db=self.db, current_user=self.other).id, "P")
        with self.assertRaises(HTTPException) as caught:
            submit_query("P", request, db=self.db, current_user=self.other)
        self.assertEqual(caught.exception.status_code, 403)
        self.assertEqual(self.db.query(Submission).count(), 1)


if __name__ == "__main__":
    unittest.main()
