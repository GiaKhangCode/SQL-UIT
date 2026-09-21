from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import ProblemListResponse, ProblemDetailResponse
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[ProblemListResponse])
def get_problems(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    problems = db.query(Problem).all()
    subs = db.query(Submission.problem_id, Submission.result).filter(Submission.user_id == current_user.id).all()
    
    status_map = {}
    for problem_id, result in subs:
        if status_map.get(problem_id) == "Solved":
            continue
        if result == "Accepted":
            status_map[problem_id] = "Solved"
        else:
            status_map[problem_id] = "In progress"

    result_list = []
    for p in problems:
        resp = ProblemListResponse.model_validate(p)
        resp.progress = status_map.get(p.id)
        result_list.append(resp)
    
    return result_list

@router.get("/{problem_id}", response_model=ProblemDetailResponse)
def get_problem(problem_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    subs = db.query(Submission.result).filter(
        Submission.user_id == current_user.id,
        Submission.problem_id == p.id
    ).all()
    
    progress = None
    if subs:
        if any(sub.result == "Accepted" for sub in subs):
            progress = "Solved"
        else:
            progress = "In progress"
            
    resp = ProblemDetailResponse.model_validate(p)
    resp.progress = progress
    return resp
