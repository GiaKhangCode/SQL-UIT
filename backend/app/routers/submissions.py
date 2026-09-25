from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, Submission, Problem
from app.schemas import SubmissionResponse, TeacherSubmissionResponse
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[SubmissionResponse])
def get_submissions(
    search: Optional[str] = None,
    result: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    query = db.query(Submission).filter(Submission.user_id == current_user.id)
    
    if result:
        query = query.filter(Submission.result == result)
    if source:
        query = query.filter(Submission.source == source)
        
    subs = query.order_by(Submission.submitted_at.desc()).all()
    
    # Lọc theo search (title của problem) nếu có
    if search:
        search_lower = search.lower()
        filtered_subs = []
        for sub in subs:
            p = db.query(Problem).filter(Problem.id == sub.problem_id).first()
            if p and search_lower in p.title.lower():
                filtered_subs.append(sub)
        return filtered_subs
        
    return subs

from pydantic import BaseModel
class ReviewRequest(BaseModel):
    finalScore: int
    feedback: str

@router.get("/{submission_id}", response_model=TeacherSubmissionResponse)
def get_submission(submission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    from fastapi import HTTPException
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    user = db.query(User).filter(User.id == sub.user_id).first()
    problem = db.query(Problem).filter(Problem.id == sub.problem_id).first()
    
    attempts = db.query(Submission).filter(
        Submission.user_id == sub.user_id,
        Submission.problem_id == sub.problem_id
    ).count()
    
    max_score = 10
    
    from app.models import TestCase
    ref_tc = db.query(TestCase).filter(TestCase.problem_id == sub.problem_id).first()
    ref_sol = ref_tc.expected_query if ref_tc else ""
    
    return TeacherSubmissionResponse(
        id=sub.id,
        student=user.name if user else "Unknown",
        problem=problem.title if problem else "Unknown",
        autoScore=sub.score,
        maxScore=max_score,
        finalScore=sub.evaluated_score,
        status="Needs review" if sub.evaluated_score is None else "Accepted",
        attempts=f"{attempts} of 3",
        query=sub.query_text or "",
        referenceSolution=ref_sol,
        submittedAt=sub.submitted_at.strftime("%b %d, %H:%M")
    )

@router.put("/{submission_id}/review", response_model=TeacherSubmissionResponse)
def review_submission(submission_id: str, review: ReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    from fastapi import HTTPException
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    sub.evaluated_score = review.finalScore
    sub.feedback = review.feedback
    
    if review.finalScore > sub.score:
        sub.score = review.finalScore
    sub.result = "Accepted"
    
    db.commit()
    db.refresh(sub)
    return get_submission(submission_id, db, current_user)
