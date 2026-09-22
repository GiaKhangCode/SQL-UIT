from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import ProblemListResponse, ProblemDetailResponse, QueryRequest, ProblemCreate, TrendingProblem
from app.routers.auth import get_current_user
from app.services.sandbox import run_sandbox
import uuid
import datetime
from sqlalchemy import func

router = APIRouter()

@router.get("/trending", response_model=List[TrendingProblem])
def get_trending(range: str = "Week", db: Session = Depends(get_db)):
    query = db.query(Submission.problem_id, func.count(func.distinct(Submission.user_id)).label("learners"))
    
    if range == "Week":
        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        query = query.filter(Submission.submitted_at >= start_date)
    elif range == "Month" or range == "Sep 2026": # support mock value from UI temporarily if needed
        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        query = query.filter(Submission.submitted_at >= start_date)
        
    results = query.group_by(Submission.problem_id).order_by(func.count(func.distinct(Submission.user_id)).desc()).limit(5).all()
    
    return [TrendingProblem(id=r[0], learners=r[1]) for r in results]

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

@router.post("", response_model=ProblemDetailResponse)
def create_problem(problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # TODO: Kiểm tra role giảng viên (current_user.role == "instructor")
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền tạo bài tập.")
        
    new_prob = Problem(
        id=str(uuid.uuid4()),
        number=problem.number,
        title=problem.title,
        topic=problem.topic,
        difficulty=problem.difficulty,
        practice_listed=problem.practice_listed,
        description=problem.description,
        requirements=problem.requirements,
        hint=problem.hint,
        tables=[t.model_dump() for t in problem.tables],
        expected=problem.expected.model_dump()
    )
    
    db.add(new_prob)
    db.commit()
    db.refresh(new_prob)
    
    resp = ProblemDetailResponse.model_validate(new_prob)
    resp.progress = "Not started"
    return resp

@router.post("/{problem_id}/run")
def run_query(problem_id: str, request: QueryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    result = run_sandbox(db, p, request.query, is_submit=False)
    return result

@router.post("/{problem_id}/submit")
def submit_query(problem_id: str, request: QueryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    result = run_sandbox(db, p, request.query, is_submit=True)
    
    # Save submission
    status = result["status"]
    score = 100 if status == "Accepted" else 0
    
    sub = Submission(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        problem_id=p.id,
        source=request.source,
        context=request.context,
        result=status,
        score=score,
        query_text=request.query,
        database_type=request.database
    )
    db.add(sub)
    db.commit()
    
    return result

