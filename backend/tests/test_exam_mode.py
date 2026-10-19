import datetime
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Base, User, Problem, Assignment, AssignmentProblem, Submission
from app.routers.activity_attempts import AttemptUpdate, get_attempt, start_attempt, update_attempt, require_open_exam, expire_due_attempts
from app.routers.problems import run_problem_workspace, submit_workspace
from app.schemas import WorkspaceRunRequest
from app.schemas import AssignmentCreate
from app.routers.assignments import create_assignment, get_assignment, update_assignment


class ExamModeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(id="S", email="s@example.test", name="S", initials="S", hashed_password="x", role="student", status="Active")
        self.activity = Assignment(id="A", title="Exam", is_contest=True, published=True,
            audience_type="all_students", exam_mode=True, opens=datetime.datetime.utcnow()-datetime.timedelta(hours=1))
        self.p = Problem(id="P", title="P", number="1", description="P", requirements="P", difficulty="Easy", workspace_parts=["DDL", "DML", "SQL"])
        self.db.add_all([self.user, self.activity, self.p,
            Problem(id="Q", title="Q", number="2", description="Q", requirements="Q", difficulty="Easy"),
            AssignmentProblem(assignment_id="A", problem_id="P", workspace_parts=["DDL", "DML", "SQL"]),
            AssignmentProblem(assignment_id="A", problem_id="Q", workspace_parts=["SQL"])])
        self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def request(self, **values):
        return AttemptUpdate.model_validate({"source": "Contests", **values})

    def update(self, action, **values):
        return update_attempt("A", action, self.request(**values), db=self.db, current_user=self.user)

    def start(self):
        return start_attempt("A", self.request(), db=self.db, current_user=self.user)

    def test_policy_start_and_access(self):
        state = get_attempt("A", "Contests", db=self.db, current_user=self.user)
        self.assertTrue(state["examMode"])
        self.assertEqual(state["status"], "not_started")
        with self.assertRaises(HTTPException): require_open_exam(self.db, self.user, self.activity)
        self.start()
        require_open_exam(self.db, self.user, self.activity)
        with self.assertRaises(HTTPException): self.update("save", problemId="unrelated", query="SELECT 1")
        with self.assertRaises(HTTPException): get_attempt("A", "Assignments", db=self.db, current_user=self.user)

    def test_two_violations_finalize_all_problems_once_and_lock_execution(self):
        self.start()
        self.update("save", problemId="P", ddl="CREATE TABLE T(id INT)", dml="INSERT INTO T VALUES(1)", query="SELECT * FROM T", revision=2)
        first = self.update("violation", eventId="one", kind="focus_lost")
        self.assertEqual((first["violationCount"], first["status"]), (1, "active"))
        replay = self.update("violation", eventId="one", kind="focus_lost")
        self.assertEqual(replay["violationCount"], 1)
        final = self.update("violation", eventId="two", kind="external_paste", problemId="Q", query="SELECT 2", revision=3)
        self.assertEqual(final["status"], "submitted")
        self.assertEqual(final["finishReason"], "violations")
        submissions = self.db.query(Submission).all()
        self.assertEqual(len(submissions), 2)
        combined = next(s for s in submissions if s.problem_id == "P")
        for part in ["CREATE TABLE T", "INSERT INTO T", "SELECT * FROM T"]: self.assertIn(part, combined.query_text)
        self.update("submit")
        self.update("violation", eventId="two", kind="external_paste")
        self.assertEqual(self.db.query(Submission).count(), 2)
        self.assertEqual(self.start()["status"], "submitted", "Reload/start cannot reopen an exam")
        with self.assertRaises(HTTPException): require_open_exam(self.db, self.user, self.activity)
        with self.assertRaises(HTTPException):
            run_problem_workspace("P", WorkspaceRunRequest(part="DDL", source="Contests", context="A"), db=self.db, current_user=self.user)

    def test_stale_autosave_cannot_overwrite_and_manual_submit_is_final(self):
        self.start()
        self.update("save", problemId="P", ddl="new", revision=20)
        saved = self.update("save", problemId="P", ddl="old", revision=10)
        self.assertEqual(saved["drafts"]["P"]["ddl"], "new")
        final = self.update("submit", problemId="P", ddl="final", revision=30)
        self.assertEqual(final["finishReason"], "student")
        saved = self.update("save", problemId="P", ddl="too late", revision=40)
        self.assertEqual(saved["drafts"]["P"]["ddl"], "final")
        self.assertEqual(self.db.query(Submission).filter(Submission.problem_id == "Q").one().result, "Not answered")

    def test_regular_multipart_submission_preserves_all_sections(self):
        self.activity.exam_mode = False
        self.db.commit()
        grade = {"status": "Accepted", "score": 10, "feedback": "All selected sections passed."}
        with patch("app.services.workspace_grading.grade_workspace_submission", return_value=grade):
            result = submit_workspace("P", WorkspaceRunRequest(part="SQL", source="Contests", context="A",
                ddl="CREATE TABLE T(id INT)", dml="INSERT INTO T VALUES(1)", query="SELECT * FROM T"), db=self.db, current_user=self.user)
        self.assertEqual(result["status"], "Accepted")
        self.assertEqual(result["score"], 10)
        query = self.db.query(Submission).one().query_text
        self.assertIn("-- DDL", query); self.assertIn("-- DML", query); self.assertIn("-- SQL", query)

    def test_teacher_policy_round_trip_and_cannot_change_after_start(self):
        teacher = User(id="T", email="t@example.test", name="T", initials="T", hashed_password="x", role="instructor", status="Active")
        self.db.add(teacher); self.db.commit()
        now = datetime.datetime.utcnow()
        request = AssignmentCreate.model_validate({"title": "Exam policy", "isContest": True,
            "audienceType": "all_students", "shortDescription": "Test", "description": "Test", "rules": "Test",
            "opens": (now-datetime.timedelta(hours=1)).isoformat(), "closes": (now+datetime.timedelta(hours=1)).isoformat(),
            "published": True, "problems": [{"id": "P", "workspaceParts": ["DDL", "DML", "SQL"], "points": 20}],
            "studentOptions": {"examMode": True}})
        created = create_assignment(request, db=self.db, current_user=teacher)
        activity_id = created["id"]
        self.assertTrue(get_assignment(activity_id, db=self.db, current_user=teacher)["studentOptions"]["examMode"])
        start_attempt(activity_id, self.request(), db=self.db, current_user=self.user)
        request.student_options.exam_mode = False
        with self.assertRaises(HTTPException) as caught:
            update_assignment(activity_id, request, db=self.db, current_user=teacher)
        self.assertEqual(caught.exception.status_code, 409)

    def test_deadline_submits_saved_work_in_normal_activity_once(self):
        self.activity.exam_mode = False
        self.activity.closes = datetime.datetime.utcnow() + datetime.timedelta(minutes=1)
        self.db.commit()
        state = get_attempt("A", "Contests", db=self.db, current_user=self.user)
        self.assertEqual(state["status"], "active")
        self.assertTrue(state["closesAt"].endswith("Z"))
        self.assertTrue(state["serverNow"].endswith("Z"))
        self.update("save", problemId="P", ddl="CREATE TABLE T(id INT)", dml="INSERT INTO T VALUES(1)", revision=1)
        self.update("save", problemId="Q", query="SELECT 1", revision=1)
        with self.assertRaises(HTTPException): self.update("timeout")
        self.activity.closes = datetime.datetime.utcnow() - datetime.timedelta(milliseconds=100)
        self.db.commit()
        final = self.update("timeout", problemId="Q", query="SELECT 2", revision=2)
        self.assertEqual(final["finishReason"], "deadline")
        self.assertEqual(self.db.query(Submission).count(), 2)
        self.assertIn("SELECT 2", self.db.query(Submission).filter(Submission.problem_id == "Q").one().query_text)
        self.update("timeout")
        expire_due_attempts(self.db)
        self.assertEqual(self.db.query(Submission).count(), 2)
        with self.assertRaises(HTTPException): require_open_exam(self.db, self.user, self.activity)

    def test_server_deadline_worker_finishes_exam_without_browser(self):
        self.start()
        self.update("save", problemId="P", ddl="CREATE TABLE T(id INT)", revision=1)
        self.activity.closes = datetime.datetime.utcnow() - datetime.timedelta(seconds=10)
        self.db.commit()
        expire_due_attempts(self.db)
        expire_due_attempts(self.db)
        self.assertEqual(self.db.query(Submission).count(), 2)
        state = get_attempt("A", "Contests", db=self.db, current_user=self.user)
        self.assertEqual((state["status"], state["finishReason"]), ("submitted", "deadline"))

    def test_deadline_keeps_existing_submission_when_limit_is_used(self):
        self.activity.exam_mode = False
        self.activity.max_submissions = 1
        self.db.commit()
        get_attempt("A", "Contests", db=self.db, current_user=self.user)
        self.update("save", problemId="P", ddl="CREATE TABLE T(id INT)", revision=1)
        submit_workspace("P", WorkspaceRunRequest(part="DDL", source="Contests", context="A", ddl="CREATE TABLE T(id INT)"), db=self.db, current_user=self.user)
        self.update("save", problemId="P", ddl="CREATE TABLE Different(id INT)", revision=2)
        self.activity.closes = datetime.datetime.utcnow() - datetime.timedelta(seconds=10)
        self.db.commit()
        expire_due_attempts(self.db)
        saved = self.db.query(Submission).filter(Submission.problem_id == "P").all()
        self.assertEqual(len(saved), 1)
        self.assertNotIn("Different", saved[0].query_text)

    def test_deadline_does_not_duplicate_identical_manually_submitted_work(self):
        self.activity.exam_mode = False
        self.db.commit()
        get_attempt("A", "Contests", db=self.db, current_user=self.user)
        self.update("save", problemId="P", ddl="CREATE TABLE T(id INT)", revision=1)
        submit_workspace("P", WorkspaceRunRequest(part="DDL", source="Contests", context="A", ddl="CREATE TABLE T(id INT)"), db=self.db, current_user=self.user)
        self.activity.closes = datetime.datetime.utcnow() - datetime.timedelta(seconds=10)
        self.db.commit()
        expire_due_attempts(self.db)
        self.assertEqual(self.db.query(Submission).filter(Submission.problem_id == "P").count(), 1)


if __name__ == "__main__": unittest.main()
