from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, Submission, Problem
from app.schemas import SubmissionResponse
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
