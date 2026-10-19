"""Server-owned exam state, snapshots and idempotent final submission."""
import datetime
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActivityAttempt, Assignment, AssignmentProblem, Problem, Submission, User
from app.routers.auth import get_current_user
from app.routers.problems import activity_problem_access, activity_workspace_parts
from app.schemas import CamelModel

router = APIRouter()


class AttemptUpdate(CamelModel):
    source: Literal["Assignments", "Contests"]
    problem_id: Optional[str] = None
    ddl: str = Field(default="", max_length=200000)
    dml: str = Field(default="", max_length=200000)
    query: str = Field(default="", max_length=200000)
    revision: int = Field(default=0, ge=0)
    event_id: Optional[str] = Field(default=None, max_length=50)
    kind: Optional[Literal["focus_lost", "external_paste", "leave_attempt"]] = None


def access(db, user, activity_id, source):
    if user.role != "student" or user.status != "Active":
        raise HTTPException(403, "Only active students can start an exam.")
    first = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == activity_id).first()
    if not first:
        raise HTTPException(404, "Activity not found.")
    return activity_problem_access(db, user, first.problem_id, activity_id, source)[0]


def locked_attempt(db, activity_id, user_id):
    return db.query(ActivityAttempt).with_hint(
        ActivityAttempt, "WITH (UPDLOCK, HOLDLOCK, ROWLOCK)", dialect_name="mssql"
    ).filter(ActivityAttempt.assignment_id == activity_id, ActivityAttempt.user_id == user_id).first()


def payload(db, activity, attempt, user_id=None):
    from app.services.submission_policy import submission_limit, scores_visible
    from sqlalchemy import func
    counts = dict(db.query(Submission.problem_id, func.count(Submission.id)).filter(
        Submission.user_id == (user_id or (attempt.user_id if attempt else "")),
        Submission.context == activity.id,
        Submission.source.in_(["Assignments", "Contests", "Assignment", "Contest"])
    ).group_by(Submission.problem_id).all())
    problem_ids = [row.problem_id for row in db.query(AssignmentProblem).filter(
        AssignmentProblem.assignment_id == activity.id
    ).order_by(AssignmentProblem.order_index).all()]
    now = datetime.datetime.utcnow()
    return {"examMode": bool(activity.exam_mode), "problemIds": problem_ids,
            "closesAt": activity.closes.isoformat() + "Z" if activity.closes else None,
            "serverNow": now.isoformat() + "Z",
            "showScoresAfterSubmit": scores_visible(activity), "maxSubmissions": submission_limit(activity),
            "submissionCounts": counts,
            "status": attempt.status if attempt else "closed" if activity.closes and now >= activity.closes else "not_started",
            "violationCount": len(attempt.violations or []) if attempt else 0,
            "drafts": attempt.drafts or {} if attempt else {},
            "finishReason": attempt.finish_reason if attempt else None}


def save_snapshot(db, activity, attempt, request):
    if not request.problem_id:
        return
    member = db.query(AssignmentProblem).filter(
        AssignmentProblem.assignment_id == activity.id,
        AssignmentProblem.problem_id == request.problem_id
    ).first()
    if not member:
        raise HTTPException(403, "This problem is not part of the selected activity.")
    drafts = dict(attempt.drafts or {})
    previous = drafts.get(request.problem_id, {})
    if request.revision >= previous.get("revision", 0):
        drafts[request.problem_id] = {"ddl": request.ddl, "dml": request.dml,
                                      "query": request.query, "revision": request.revision}
        attempt.drafts = drafts


def store_submission(db, user_id, problem, source, context, scripts, parts, reason=None,
                     maximum=100):
    text = "\n\n".join(f"-- {part}\n{scripts.get({'DDL': 'ddl', 'DML': 'dml', 'SQL': 'query'}[part], '')}"
                       for part in parts)
    answered = any(scripts.get(key, "").strip() for key in ("ddl", "dml", "query"))
    if answered:
        from app.services.workspace_grading import grade_workspace_submission
        options = {}
        if source in ("Assignments", "Contests"):
            member = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == context, AssignmentProblem.problem_id == problem.id).first()
            if member and member.dataset_visibility:
                options["dataset_visibility"] = member.dataset_visibility
        grade = grade_workspace_submission(db, problem, scripts, parts, maximum, **options)
        result = grade["status"]
        score = grade["score"]
        feedback = grade.get("feedback")
    else:
        result = "Not answered"
        score = 0
        feedback = "Automatically submitted after two exam violations." if reason == "violations" else None
    submission = Submission(id=str(uuid.uuid4()), user_id=user_id, problem_id=problem.id,
        source=source, context=context, query_text=text, database_type="SQL Server",
        result=result, score=score, evaluated_score=score if answered else None,
        feedback=feedback)
    db.add(submission)
    return submission


def finish(db, activity, attempt, source, reason):
    if attempt.status != "active":
        return
    from app.services.submission_policy import submission_limit, submissions_used
    db.query(User).with_hint(User, "WITH (UPDLOCK, HOLDLOCK, ROWLOCK)", dialect_name="mssql").filter(User.id == attempt.user_id).first()
    for member in db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == activity.id).all():
        problem = db.query(Problem).filter(Problem.id == member.problem_id).first()
        if problem:
            limit = submission_limit(activity)
            if limit is not None and submissions_used(db, attempt.user_id, activity.id, problem.id) >= limit:
                continue
            scripts = (attempt.drafts or {}).get(problem.id, {})
            parts = activity_workspace_parts(problem, activity, member)
            maximum = member.points
            if reason == "deadline":
                latest = db.query(Submission).filter(Submission.user_id == attempt.user_id,
                    Submission.context == activity.id, Submission.problem_id == problem.id,
                    Submission.source.in_(["Assignments", "Contests", "Assignment", "Contest"])
                ).order_by(Submission.submitted_at.desc()).first()
                text = "\n\n".join(f"-- {part}\n{scripts.get({'DDL': 'ddl', 'DML': 'dml', 'SQL': 'query'}[part], '')}" for part in parts)
                if latest and (latest.query_text or "").strip() in (text.strip(), scripts.get("query", "").strip() if parts == ["SQL"] else text.strip()):
                    continue
            store_submission(db, attempt.user_id, problem, source, activity.id,
                             scripts, parts, reason, maximum)
    attempt.status = "submitted"
    attempt.finish_reason = reason
    attempt.submitted_at = datetime.datetime.utcnow()


def require_open_exam(db, user, activity):
    """Used by every execution/submission route; URL flags cannot bypass exam policy."""
    if user.role != "student":
        return
    if activity.closes and datetime.datetime.utcnow() >= activity.closes:
        raise HTTPException(403, "This activity has ended. Your saved work will be submitted automatically.")
    if not activity.exam_mode:
        return
    attempt = db.query(ActivityAttempt).filter(ActivityAttempt.assignment_id == activity.id,
                                              ActivityAttempt.user_id == user.id).first()
    if not attempt or attempt.status != "active":
        raise HTTPException(403, "Start the exam before working. A submitted exam cannot be reopened.")


@router.get("/{activity_id}")
def get_attempt(activity_id: str, source: Literal["Assignments", "Contests"],
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = access(db, current_user, activity_id, source)
    attempt = locked_attempt(db, activity_id, current_user.id)
    now = datetime.datetime.utcnow()
    if not attempt and not activity.exam_mode and (not activity.closes or now < activity.closes):
        attempt = create_attempt(db, activity_id, current_user.id)
    if attempt and attempt.status == "active" and activity.closes and now >= activity.closes + datetime.timedelta(seconds=3):
        finish(db, activity, attempt, source, "deadline")
        db.commit()
    return payload(db, activity, attempt, current_user.id)


def create_attempt(db, activity_id, user_id):
    attempt = ActivityAttempt(assignment_id=activity_id, user_id=user_id, status="active", drafts={}, violations=[])
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        attempt = locked_attempt(db, activity_id, user_id)
    return attempt


@router.post("/{activity_id}/start")
def start_attempt(activity_id: str, request: AttemptUpdate,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = access(db, current_user, activity_id, request.source)
    if not activity.exam_mode:
        raise HTTPException(400, "Exam mode is not enabled for this activity.")
    if activity.closes and datetime.datetime.utcnow() >= activity.closes:
        raise HTTPException(403, "This activity has closed.")
    attempt = locked_attempt(db, activity_id, current_user.id)
    if not attempt:
        attempt = create_attempt(db, activity_id, current_user.id)
    return payload(db, activity, attempt, current_user.id)


@router.post("/{activity_id}/{action}")
def update_attempt(activity_id: str, action: Literal["save", "violation", "submit", "timeout"], request: AttemptUpdate,
                   db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = access(db, current_user, activity_id, request.source)
    attempt = locked_attempt(db, activity_id, current_user.id)
    now = datetime.datetime.utcnow()
    expired = bool(activity.closes and now >= activity.closes)
    if action == "timeout" and not expired:
        raise HTTPException(400, "This activity has not ended yet.")
    if not attempt and not activity.exam_mode and not expired:
        attempt = create_attempt(db, activity_id, current_user.id)
    if not attempt:
        raise HTTPException(403, "Start the exam before working.")
    if attempt.status == "active":
        if expired and now >= activity.closes + datetime.timedelta(seconds=3):
            finish(db, activity, attempt, request.source, "deadline")
            db.commit()
            return payload(db, activity, attempt, current_user.id)
        save_snapshot(db, activity, attempt, request)
        if expired and action != "save":
            finish(db, activity, attempt, request.source, "deadline")
        elif action == "violation":
            if not activity.exam_mode:
                raise HTTPException(400, "Exam mode is not enabled for this activity.")
            if not request.event_id or not request.kind:
                raise HTTPException(400, "A violation needs an event ID and kind.")
            events = list(attempt.violations or [])
            if not any(event["id"] == request.event_id for event in events):
                events.append({"id": request.event_id, "kind": request.kind,
                               "at": datetime.datetime.utcnow().isoformat()})
                attempt.violations = events
            if len(events) >= 2:
                finish(db, activity, attempt, request.source, "violations")
        elif action == "submit":
            if not activity.exam_mode:
                raise HTTPException(400, "Use the problem submission action before the deadline.")
            finish(db, activity, attempt, request.source, "student")
        db.commit()
    return payload(db, activity, attempt, current_user.id)


def expire_due_attempts(db):
    """Finalize persisted drafts independently of the browser, once per activity/student."""
    due = db.query(ActivityAttempt.assignment_id, ActivityAttempt.user_id).join(
        Assignment, Assignment.id == ActivityAttempt.assignment_id
    ).filter(ActivityAttempt.status == "active", Assignment.closes != None,
             Assignment.closes <= datetime.datetime.utcnow() - datetime.timedelta(seconds=3)).all()
    for activity_id, user_id in due:
        attempt = locked_attempt(db, activity_id, user_id)
        activity = db.query(Assignment).filter(Assignment.id == activity_id).first()
        if attempt and activity:
            finish(db, activity, attempt, "Contests" if activity.is_contest else "Assignments", "deadline")
            db.commit()
