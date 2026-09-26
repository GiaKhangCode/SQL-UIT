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

def check_problem_access(db: Session, current_user: User, p: Problem):
    if p.practice_listed:
        return True
    if current_user.role == "admin":
        return True
    if current_user.role == "instructor" and p.creator_id == current_user.id:
        return True
    if current_user.role == "student":
        from app.models import ClassEnrollment, AssignmentClass, AssignmentProblem, Assignment
        import datetime
        now = datetime.datetime.utcnow()
        assigned = db.query(AssignmentProblem.problem_id)\
            .join(AssignmentClass, AssignmentClass.assignment_id == AssignmentProblem.assignment_id)\
            .join(ClassEnrollment, ClassEnrollment.class_id == AssignmentClass.class_id)\
            .join(Assignment, Assignment.id == AssignmentProblem.assignment_id)\
            .filter(
                ClassEnrollment.student_id == current_user.id, 
                AssignmentProblem.problem_id == p.id,
                Assignment.published == True,
                (Assignment.opens == None) | (Assignment.opens <= now),
                (Assignment.closes == None) | (Assignment.closes > now)
            ).first()
        if assigned:
            return True
    return False

@router.get("/trending", response_model=List[TrendingProblem])
def get_trending(range: str = "Week", db: Session = Depends(get_db)):
    query = db.query(
        Submission.problem_id, 
        Problem.number,
        Problem.title,
        func.count(func.distinct(Submission.user_id)).label("learners")
    ).join(Problem, Problem.id == Submission.problem_id).filter(Problem.practice_listed == True)
    
    if range == "Week":
        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        query = query.filter(Submission.submitted_at >= start_date)
    elif range == "Month": 
        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        query = query.filter(Submission.submitted_at >= start_date)
        
    results = query.group_by(
        Submission.problem_id, 
        Problem.number, 
        Problem.title
    ).order_by(func.count(func.distinct(Submission.user_id)).desc()).limit(5).all()
    
    return [TrendingProblem(id=r[0], number=r[1], title=r[2], learners=r[3]) for r in results]

@router.get("", response_model=List[ProblemListResponse])
def get_problems(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import ClassEnrollment, AssignmentClass, AssignmentProblem
    
    if current_user.role == "instructor":
        problems = db.query(Problem).filter(
            (Problem.practice_listed == True) | 
            (Problem.creator_id == current_user.id)
        ).all()
    elif current_user.role == "admin":
        problems = db.query(Problem).all()
    else:
        from app.models import Assignment
        import datetime
        now = datetime.datetime.utcnow()
        assigned_pids_query = db.query(AssignmentProblem.problem_id)\
            .join(AssignmentClass, AssignmentClass.assignment_id == AssignmentProblem.assignment_id)\
            .join(ClassEnrollment, ClassEnrollment.class_id == AssignmentClass.class_id)\
            .join(Assignment, Assignment.id == AssignmentProblem.assignment_id)\
            .filter(
                ClassEnrollment.student_id == current_user.id,
                Assignment.published == True,
                (Assignment.opens == None) | (Assignment.opens <= now)
            ).subquery()
            
        submitted_pids_query = db.query(Submission.problem_id)\
            .filter(Submission.user_id == current_user.id).subquery()
            
        problems = db.query(Problem).filter(
            (Problem.practice_listed == True) | 
            (Problem.id.in_(assigned_pids_query)) |
            (Problem.id.in_(submitted_pids_query))
        ).all()
        
    # Progress cho current_user
    subs = db.query(Submission.problem_id, Submission.result).filter(Submission.user_id == current_user.id).all()
    
    status_map = {}
    for problem_id, result in subs:
        if status_map.get(problem_id) == "Solved":
            continue
        if result == "Accepted":
            status_map[problem_id] = "Solved"
        else:
            status_map[problem_id] = "In progress"

    # Tính toán stats
    from sqlalchemy import func, case
    stats_query = db.query(
        Submission.problem_id,
        func.count(Submission.id).label("total_subs"),
        func.count(func.distinct(Submission.user_id)).label("attempted"),
        func.count(func.distinct(case((Submission.result == 'Accepted', Submission.user_id), else_=None))).label("solved_by"),
        func.sum(case((Submission.result == 'Accepted', 1), else_=0)).label("accepted_subs")
    ).group_by(Submission.problem_id).all()

    stats_map = {}
    for r in stats_query:
        problem_id, total_subs, attempted, solved_by, accepted_subs = r
        acceptance = int((accepted_subs / total_subs * 100)) if total_subs > 0 else 0
        stats_map[problem_id] = {
            "submissions": total_subs,
            "attempted": attempted,
            "solved_by": solved_by,
            "acceptance": acceptance
        }

    result_list = []
    for p in problems:
        resp = ProblemListResponse.model_validate(p)
        resp.progress = status_map.get(p.id)
        
        p_stats = stats_map.get(p.id, {"submissions": 0, "attempted": 0, "solved_by": 0, "acceptance": 0})
        resp.submissions = p_stats["submissions"]
        resp.attempted = p_stats["attempted"]
        resp.solved_by = p_stats["solved_by"]
        resp.acceptance = p_stats["acceptance"]
        
        result_list.append(resp)
    
    return result_list

from typing import Optional

@router.get("/{problem_id}", response_model=ProblemDetailResponse)
def get_problem(problem_id: str, context: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    if not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to view this problem.")
                
    subs_query = db.query(Submission.result).filter(
        Submission.user_id == current_user.id,
        Submission.problem_id == p.id
    )
    if context and context != "Practice":
        subs_query = subs_query.filter(Submission.context == context)
        
    subs = subs_query.all()
    
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
                    if current_user.role in ["instructor", "admin"]:
                        resp.reference_solution = tc.expected_query or ""
                    else:
                        resp.reference_solution = ""
        resp.test_cases = mapped_tcs
        
    return resp

@router.put("/{problem_id}", response_model=ProblemDetailResponse)
def update_problem(problem_id: str, problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền sửa bài tập.")
        
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    if p.creator_id and p.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't have permission to edit this problem.")
        
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
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền xóa bài tập.")
        
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    if p.creator_id and p.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't have permission to delete this problem.")
        
    from app.models import ProblemTopic, TestCase, TestCaseScript, Submission, ProblemDraft, Favorite, ProblemListItem, AiChatSession, AssignmentProblem
    
    # Delete related dependencies to avoid foreign key constraints
    db.query(AssignmentProblem).filter(AssignmentProblem.problem_id == problem_id).delete()
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
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền tạo bài tập.")
        
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
        database_type=problem.database,
        creator_id=current_user.id
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
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền sử dụng công cụ kiểm tra Sandbox.")
        
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
        
    if not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to run this problem.")
        
    result = run_sandbox(db, p, request.query, is_submit=False)
    return result

@router.post("/{problem_id}/submit")
def submit_query(problem_id: str, request: QueryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    if not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to submit this problem.")
        
    max_score = 100
    
    if not p.practice_listed:
        if request.source not in ["Assignments", "Contests"] or not request.context:
            raise HTTPException(status_code=403, detail="Bài tập này không cho phép nộp tự do (Practice). Cần nộp thông qua Assignment hợp lệ.")
            
    if request.source in ["Assignments", "Contests"] and request.context:
        from app.models import Assignment, AssignmentProblem, AssignmentClass, ClassEnrollment
        assignment = db.query(Assignment).filter(Assignment.id == request.context).first()
        if assignment:
            if current_user.role not in ["instructor", "admin"]:
                if not assignment.published:
                    raise HTTPException(status_code=403, detail="Bài tập/Kỳ thi chưa được công bố.")
                now = datetime.datetime.utcnow()
                if assignment.opens and now < assignment.opens:
                    raise HTTPException(status_code=403, detail="Bài tập/Kỳ thi chưa được mở.")
                if assignment.closes and now > assignment.closes:
                    raise HTTPException(status_code=403, detail="Bài tập/Kỳ thi đã hết hạn nộp bài.")
                    
                # Check if the student is enrolled in any class assigned to this assignment
                enrollment = db.query(ClassEnrollment).join(
                    AssignmentClass, AssignmentClass.class_id == ClassEnrollment.class_id
                ).filter(
                    AssignmentClass.assignment_id == assignment.id,
                    ClassEnrollment.student_id == current_user.id
                ).first()
                if not enrollment:
                    raise HTTPException(status_code=403, detail="Bạn không thuộc lớp được giao bài tập này.")
                    
            ap = db.query(AssignmentProblem).filter(
                AssignmentProblem.assignment_id == assignment.id,
                AssignmentProblem.problem_id == p.id
            ).first()
            if ap:
                max_score = ap.points
                
    result = run_sandbox(db, p, request.query, is_submit=True)
    
    # Save submission
    status = result.get("status", "Runtime Error")
    
    passed = result.get("passed", 0)
    total = result.get("total", 1)
    
    if status == "Accepted":
        score = max_score
    elif status == "Partial":
        score = int((passed / total) * max_score)
    else:
        score = 0
    
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

