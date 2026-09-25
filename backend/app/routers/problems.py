from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import ProblemListResponse, ProblemDetailResponse, QueryRequest, ProblemCreate, TestCaseCreate, ProblemValidateRequest, TrendingProblem
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
    
    from app.models import TestCase, TestCaseScript
    tcs = db.query(TestCase).filter(TestCase.problem_id == p.id).order_by(TestCase.order_index).all()
    if tcs:
        mapped_tcs = []
        for idx, tc in enumerate(tcs):
            script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).first()
            if script:
                mapped_tcs.append({
                    "schema": script.create_script,
                    "seedData": script.insert_script,
                    "isHidden": tc.is_hidden
                })
                if idx == 0:
                    resp.schema_sql = script.create_script
                    resp.seed_data = script.insert_script
                    resp.reference_solution = tc.expected_query or ""
        resp.test_cases = mapped_tcs
        
    return resp

@router.put("/{problem_id}", response_model=ProblemDetailResponse)
def update_problem(problem_id: str, problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền sửa bài tập.")
        
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    topics_list = [t.strip() for t in problem.topics.split(",")] if problem.topics else []
    
    p.number = problem.number
    p.title = problem.title
    p.topic = problem.topics
    p.topics = topics_list
    p.difficulty = problem.difficulty
    p.practice_listed = (problem.visibility == "Public")
    p.description = problem.statement
    p.requirements = problem.requirements
    p.hint = "\n".join(problem.hints) if problem.hints else None
    p.database_type = problem.database
    
    from app.models import Topic, ProblemTopic, TestCase, TestCaseScript
    
    db.query(ProblemTopic).filter(ProblemTopic.problem_id == problem_id).delete()
    for t_name in topics_list:
        if not t_name: continue
        topic_obj = db.query(Topic).filter(Topic.name == t_name).first()
        if not topic_obj:
            topic_obj = Topic(id=str(uuid.uuid4()), name=t_name)
            db.add(topic_obj)
            db.commit()
            db.refresh(topic_obj)
        pt = ProblemTopic(problem_id=problem_id, topic_id=topic_obj.id)
        db.add(pt)
        
    old_tcs = db.query(TestCase).filter(TestCase.problem_id == problem_id).all()
    for tc in old_tcs:
        db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).delete()
    db.query(TestCase).filter(TestCase.problem_id == problem_id).delete()
    
    test_cases_to_create = problem.test_cases if problem.test_cases else [
        TestCaseCreate(schema_sql=problem.schema_sql, seed_data=problem.seed_data, is_hidden=False)
    ]
    
    for idx, tc_data in enumerate(test_cases_to_create):
        tc_id = str(uuid.uuid4())
        tc = TestCase(
            id=tc_id,
            problem_id=problem_id,
            is_hidden=tc_data.is_hidden,
            order_index=idx + 1,
            expected_query=problem.reference_solution
        )
        db.add(tc)
        
        tcs = TestCaseScript(
            id=str(uuid.uuid4()),
            test_case_id=tc_id,
            table_name="Generated", 
            create_script=tc_data.schema_sql or problem.schema_sql,
            insert_script=tc_data.seed_data,
            is_expected=False
        )
        db.add(tcs)
        
    db.commit()
    db.refresh(p)
    return get_problem(problem_id, db, current_user)

@router.delete("/{problem_id}")
def delete_problem(problem_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền xóa bài tập.")
        
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    from app.models import ProblemTopic, TestCase, TestCaseScript, Submission, ProblemDraft, Favorite, ProblemListItem, AiChatSession
    
    # Delete related dependencies to avoid foreign key constraints
    db.query(Submission).filter(Submission.problem_id == problem_id).delete()
    db.query(ProblemDraft).filter(ProblemDraft.problem_id == problem_id).delete()
    db.query(Favorite).filter(Favorite.problem_id == problem_id).delete()
    db.query(ProblemListItem).filter(ProblemListItem.problem_id == problem_id).delete()
    
    # AiChatSession has CASCADE for its messages, so deleting session is enough if DB supports it, 
    # but manually deleting is safer.
    from app.models import AiChatMessage
    sessions = db.query(AiChatSession).filter(AiChatSession.problem_id == problem_id).all()
    for s in sessions:
        db.query(AiChatMessage).filter(AiChatMessage.session_id == s.id).delete()
    db.query(AiChatSession).filter(AiChatSession.problem_id == problem_id).delete()
    
    db.query(ProblemTopic).filter(ProblemTopic.problem_id == problem_id).delete()
    
    tcs = db.query(TestCase).filter(TestCase.problem_id == problem_id).all()
    for tc in tcs:
        db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).delete()
    db.query(TestCase).filter(TestCase.problem_id == problem_id).delete()
    
    db.delete(p)
    db.commit()
    return {"message": "Deleted successfully"}

@router.post("", response_model=ProblemDetailResponse)
def create_problem(problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền tạo bài tập.")
        
    prob_id = str(uuid.uuid4())
    topics_list = [t.strip() for t in problem.topics.split(",")] if problem.topics else []
    legacy_topic = problem.topics

    new_prob = Problem(
        id=prob_id,
        number=problem.number,
        title=problem.title,
        topic=legacy_topic,
        topics=topics_list,
        difficulty=problem.difficulty,
        practice_listed=(problem.visibility == "Public"),
        description=problem.statement,
        requirements=problem.requirements,
        hint="\n".join(problem.hints) if problem.hints else None,
        database_type=problem.database
    )
    db.add(new_prob)
    
    from app.models import Topic, ProblemTopic, TestCase, TestCaseScript
    for t_name in topics_list:
        if not t_name: continue
        topic_obj = db.query(Topic).filter(Topic.name == t_name).first()
        if not topic_obj:
            topic_obj = Topic(id=str(uuid.uuid4()), name=t_name)
            db.add(topic_obj)
            db.commit()
            db.refresh(topic_obj)
        
        pt = ProblemTopic(problem_id=prob_id, topic_id=topic_obj.id)
        db.add(pt)
        
    test_cases_to_create = problem.test_cases if problem.test_cases else [
        TestCaseCreate(schema_sql=problem.schema_sql, seed_data=problem.seed_data, is_hidden=False)
    ]
    
    for idx, tc_data in enumerate(test_cases_to_create):
        tc_id = str(uuid.uuid4())
        tc = TestCase(
            id=tc_id,
            problem_id=prob_id,
            is_hidden=tc_data.is_hidden,
            order_index=idx + 1,
            expected_query=problem.reference_solution
        )
        db.add(tc)
        
        tcs = TestCaseScript(
            id=str(uuid.uuid4()),
            test_case_id=tc_id,
            table_name="Generated", 
            create_script=tc_data.schema_sql or problem.schema_sql,
            insert_script=tc_data.seed_data,
            is_expected=False
        )
        db.add(tcs)
    
    db.commit()
    db.refresh(new_prob)
    
    resp = ProblemDetailResponse.model_validate(new_prob)
    resp.progress = "Not started"
    return resp

@router.post("/validate")
def validate_problem_solution(request: ProblemValidateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.sandbox import run_validate_sandbox
    result = run_validate_sandbox(db, request.schema_sql, request.seed_data, request.reference_solution)
    if result["status"] == "Error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

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

