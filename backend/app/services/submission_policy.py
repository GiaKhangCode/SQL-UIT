"""Shared activity submission limits and student score visibility."""
from fastapi import HTTPException
from app.models import User, Submission


def scores_visible(activity):
    return activity is None or activity.show_scores_after_submit is not False


def submission_limit(activity):
    return 1 if activity.exam_mode else activity.max_submissions


def submissions_used(db, user_id, activity_id, problem_id):
    return db.query(Submission).filter(Submission.user_id == user_id,
        Submission.context == activity_id, Submission.problem_id == problem_id,
        Submission.source.in_(["Assignments", "Contests", "Assignment", "Contest"])).count()


def check_submission_limit(db, user, activity, problem_id):
    # Serialize concurrent final submissions from this student, without locking
    # every student in the same activity. The caller commits after saving.
    db.query(User).with_hint(User, "WITH (UPDLOCK, HOLDLOCK, ROWLOCK)", dialect_name="mssql").filter(User.id == user.id).first()
    used = submissions_used(db, user.id, activity.id, problem_id)
    limit = submission_limit(activity)
    if limit is not None and used >= limit:
        raise HTTPException(403, "You have reached the submission limit for this problem.")
    return used + 1


def submission_receipt(activity, used, score=None, maximum=100, pending=False):
    visible = scores_visible(activity)
    return {"scoreVisible": visible, "score": score if visible and not pending else None,
            "maxScore": maximum, "submissionsUsed": used,
            "maxSubmissions": submission_limit(activity) if activity else None}
