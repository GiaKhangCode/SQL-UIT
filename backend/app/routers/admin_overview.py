from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, date

from app.database import SessionLocal
from app import models, schemas
from app.routers.auth import get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_admin_role(current_user: models.User = Depends(get_current_user)):
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action."
        )
    return current_user

@router.get("/stats", response_model=schemas.OverviewStats)
def get_overview_stats(db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    users_count = db.query(models.User).count()
    active_classes = db.query(models.Class).filter(models.Class.status == "Active").count()
    
    # Submissions today
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)
    submissions_today = db.query(models.Submission).filter(models.Submission.submitted_at >= today_start).count()
    
    # Grading errors
    grading_errors = db.query(models.Submission).filter(
        (models.Submission.result.ilike("%error%")) | 
        (models.Submission.result.ilike("%timeout%"))
    ).count()
    
    pending_requests = db.query(models.User).filter(
        models.User.role == "instructor",
        models.User.status == "Pending"
    ).count()
    
    unassigned_classes = db.query(models.Class).filter(
        models.Class.status != "Archived",
        models.Class.instructor_id == None
    ).count()
    
    return schemas.OverviewStats(
        users=users_count,
        classes=active_classes,
        pending_requests=pending_requests,
        unassigned_classes=unassigned_classes,
        submissions_today=submissions_today,
        grading_errors=grading_errors
    )

@router.get("/activities", response_model=List[schemas.ActivityLogResponse])
def get_activities(db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).limit(10).all()
    results = []
    for log in logs:
        time_str = log.created_at.isoformat() + "Z" if log.created_at else ""
        by_str = log.user.name if log.user else "System"
        results.append(schemas.ActivityLogResponse(
            id=log.id,
            action=log.action,
            by=by_str,
            time=time_str
        ))
    return results

@router.get("/errors", response_model=List[schemas.GradingErrorResponse])
def get_errors(db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    errors = db.query(models.Submission).filter(
        (models.Submission.result.ilike("%error%")) | 
        (models.Submission.result.ilike("%timeout%"))
    ).order_by(models.Submission.submitted_at.desc()).limit(5).all()
    
    results = []
    for error in errors:
        problem = db.query(models.Problem).filter(models.Problem.id == error.problem_id).first()
        title = problem.title if problem else "Unknown problem"
        results.append(schemas.GradingErrorResponse(
            id=error.id,
            problem_title=title,
            error_type=error.result
        ))
    return results
