import datetime
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Base, User, Problem, Assignment, AssignmentProblem, Submission, Notification
from app.schemas import QueryRequest, WorkspaceRunRequest, StudentOptions, AssignmentCreate
from app.routers.problems import submit_query, submit_workspace
from app.routers.activity_attempts import get_attempt
from app.routers.submissions import get_submissions, get_submission, review_submission, ReviewRequest
from app.routers.student_assignments import get_student_assignments
from app.routers.assignments import get_assignment, update_assignment


class SubmissionPolicyTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.student = User(id="S", email="s@test.example", name="Student", initials="S", hashed_password="x", role="student", status="Active")
        self.teacher = User(id="T", email="t@test.example", name="Teacher", initials="T", hashed_password="x", role="instructor", status="Active")
        self.activity = Assignment(id="A", title="Contest", is_contest=True, instructor_id="T", published=True,
            audience_type="all_students", opens=datetime.datetime.utcnow()-datetime.timedelta(hours=1),
            closes=datetime.datetime.utcnow()+datetime.timedelta(hours=1), max_submissions=1,
            show_scores_after_submit=True, leaderboard_enabled=True)
        self.db.add_all([self.student, self.teacher, self.activity,
            Problem(id="P", number="1", title="Query", description="P", requirements="P", difficulty="Easy", workspace_parts=["SQL"]),
            Problem(id="Q", number="2", title="Multi", description="Q", requirements="Q", difficulty="Easy", workspace_parts=["DDL", "DML", "SQL"]),
            AssignmentProblem(assignment_id="A", problem_id="P", points=25, workspace_parts=["SQL"]),
            AssignmentProblem(assignment_id="A", problem_id="Q", points=75, workspace_parts=["DDL", "DML", "SQL"])])
        self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def sql_submit(self):
        return submit_query("P", QueryRequest(query="SELECT 1", source="Contests", context="A"), db=self.db, current_user=self.student)

    def test_sql_limit_is_persistent_and_does_not_run_grader_again(self):
        with patch("app.routers.problems.run_sandbox", return_value={"status": "Accepted", "message": "Passed", "passed": 1, "total": 1}) as runner:
            receipt = self.sql_submit()
            self.assertEqual((receipt["score"], receipt["maxScore"], receipt["submissionsUsed"], receipt["maxSubmissions"]), (25, 25, 1, 1))
            with self.assertRaises(HTTPException) as raised: self.sql_submit()
            self.assertEqual(raised.exception.status_code, 403)
            self.assertEqual(runner.call_count, 1)
        state = get_attempt("A", "Contests", db=self.db, current_user=self.student)
        self.assertEqual(state["submissionCounts"]["P"], 1)
        self.assertEqual(self.db.query(Submission).count(), 1)

    def test_multipart_limit_is_per_problem_and_blank_means_unlimited(self):
        self.activity.max_submissions = 2; self.db.commit()
        request = WorkspaceRunRequest(part="SQL", source="Contests", context="A", ddl="CREATE TABLE T(id INT)", query="SELECT * FROM T")
        grade = {"status": "Partial", "score": 37, "feedback": "Some sections passed."}
        with patch("app.services.workspace_grading.grade_workspace_submission", return_value=grade):
            for expected in (1, 2):
                value = submit_workspace("Q", request, db=self.db, current_user=self.student)
                self.assertEqual(value["submissionsUsed"], expected)
                self.assertEqual(value["score"], 37, "Multi-section submissions are graded immediately")
        with self.assertRaises(HTTPException): submit_workspace("Q", request, db=self.db, current_user=self.student)
        with patch("app.routers.problems.run_sandbox", return_value={"status": "Accepted", "message": "Passed"}):
            self.assertEqual(self.sql_submit()["submissionsUsed"], 1, "Other problems retain their own allowance")
        self.activity.max_submissions = None; self.db.commit()
        with patch("app.services.workspace_grading.grade_workspace_submission", return_value=grade):
            self.assertEqual(submit_workspace("Q", request, db=self.db, current_user=self.student)["submissionsUsed"], 3)

    def test_hidden_scores_do_not_leak_in_receipt_history_details_or_contest(self):
        self.activity.show_scores_after_submit = False; self.db.commit()
        with patch("app.routers.problems.run_sandbox", return_value={"status": "Accepted", "message": "Passed", "passed": 1, "total": 1}):
            receipt = self.sql_submit()
        self.assertIsNone(receipt["score"])
        self.assertFalse(receipt["scoreVisible"])
        self.assertEqual(receipt["status"], "Submitted")
        self.assertNotIn("passed", receipt)
        history = get_submissions(db=self.db, current_user=self.student)
        self.assertIsNone(history[0].score)
        self.assertIsNone(history[0].evaluated_score)
        self.assertEqual(history[0].result, "Submitted")
        sub = self.db.query(Submission).one()
        self.assertEqual(sub.score, 25, "Teacher grading data must be preserved")
        student_view = get_submission(sub.id, db=self.db, current_user=self.student)
        teacher_view = get_submission(sub.id, db=self.db, current_user=self.teacher)
        self.assertIsNone(student_view.auto_score)
        self.assertEqual(teacher_view.auto_score, 25)
        activity = get_student_assignments(db=self.db, current_user=self.student)["assignments"][0]
        self.assertIsNone(activity["score"])
        self.assertEqual(activity["leaderboard"], [])
        self.assertFalse(activity["leaderboardEnabled"])

    def test_review_notification_respects_hidden_scores(self):
        self.activity.show_scores_after_submit = False; self.db.commit()
        sub = Submission(id="sub", user_id="S", problem_id="P", source="Contests", context="A", result="Pending review", score=0)
        self.db.add(sub); self.db.commit()
        review_submission("sub", ReviewRequest(finalScore=18, feedback="18 points"), db=self.db, current_user=self.teacher)
        message = self.db.query(Notification).one().message
        self.assertNotIn("18", message)
        self.assertIsNone(get_submission("sub", db=self.db, current_user=self.student).final_score)

    def test_teacher_settings_round_trip_and_validation(self):
        options = {"showScoresAfterSubmit": False, "maxSubmissions": 3}
        request = AssignmentCreate.model_validate({"title": "Contest", "isContest": True, "audienceType": "all_students",
            "published": False, "problems": [{"id": "P", "points": 25, "workspaceParts": ["SQL"]}], "studentOptions": options})
        update_assignment("A", request, db=self.db, current_user=self.teacher)
        saved = get_assignment("A", db=self.db, current_user=self.teacher)["studentOptions"]
        self.assertEqual((saved["showScoresAfterSubmit"], saved["maxSubmissions"]), (False, 3))
        for limit in (0, -1, 101):
            with self.assertRaises(ValidationError): StudentOptions.model_validate({"maxSubmissions": limit})


if __name__ == "__main__": unittest.main()
