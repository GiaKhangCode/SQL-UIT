from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import WorkspaceRunRequest, ProblemListResponse, ProblemDetailResponse, QueryRequest, ProblemCreate, TestCaseCreate, ProblemValidateRequest, TrendingProblem, DataTable
from app.routers.auth import get_current_user
from app.services.sandbox import run_sandbox
from app.services.sql_solutions import stored_solutions, save_solutions, solution_response
from app.services.expected_outputs import read_expected_outputs, save_expected_outputs
import uuid
import datetime
from sqlalchemy import func

router = APIRouter()


def activity_problem_access(db: Session, current_user: User, problem_id: str,
                            activity_id: str, source: str, for_submit: bool = False):
    from app.models import Assignment, AssignmentProblem, AssignmentClass, ClassEnrollment
    activity = db.query(Assignment).filter(Assignment.id == activity_id).first() if activity_id else None
    if not activity or activity.is_contest != (source == "Contests"):
        raise HTTPException(status_code=404, detail="Assignment or contest not found.")
    ap = db.query(AssignmentProblem).filter(
        AssignmentProblem.assignment_id == activity.id,
        AssignmentProblem.problem_id == problem_id
    ).first()
    if not ap:
        raise HTTPException(status_code=403, detail="This problem is not part of the selected activity.")
    if current_user.role == "instructor" and activity.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="This activity belongs to another teacher.")
    if current_user.role == "student":
        if current_user.status != "Active" or not activity.published:
            raise HTTPException(status_code=403, detail="This activity is not available.")
        now = datetime.datetime.utcnow()
        if activity.opens and now < activity.opens:
            raise HTTPException(status_code=403, detail="Problems become available when the activity starts.")
        if for_submit and activity.closes and now >= activity.closes:
            raise HTTPException(status_code=403, detail="Submissions are closed for this activity.")
        if not (activity.is_contest and activity.audience_type == "all_students"):
            enrollment = db.query(ClassEnrollment).join(
                AssignmentClass, AssignmentClass.class_id == ClassEnrollment.class_id
            ).filter(
                AssignmentClass.assignment_id == activity.id,
                ClassEnrollment.student_id == current_user.id
            ).first()
            if not enrollment:
                raise HTTPException(status_code=403, detail="You are not in an assigned class.")
    return activity, ap


def activity_workspace_parts(problem: Problem, activity=None, assignment_problem=None):
    if activity is not None and assignment_problem is not None:
        if assignment_problem.workspace_parts is not None:
            return assignment_problem.workspace_parts
        # Older activity rows may predate per-activity workspace settings. Keep
        # their runtime behavior consistent with the builder's displayed default.
        return ["DDL", "DML", "SQL"]
    return problem.workspace_parts or ["SQL"]

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
        
    activity = None
    activity_problem = None
    if context and context != "Practice":
        from app.models import Assignment
        linked = db.query(Assignment).filter(Assignment.id == context).first()
        if linked:
            activity, activity_problem = activity_problem_access(db, current_user, p.id, context,
                                                                  "Contests" if linked.is_contest else "Assignments")
        else:
            raise HTTPException(status_code=404, detail="Activity not found.")
    elif not check_problem_access(db, current_user, p):
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
    expected_outputs, expected_output_visible = read_expected_outputs(p.expected)
    expected_output_tables = [DataTable.model_validate(output) for output in expected_outputs]
    resp.expected_output_visible = expected_output_visible
    resp.expected_outputs = expected_output_tables if current_user.role != "student" or expected_output_visible else []
    resp.expected = expected_output_tables[0] if expected_output_tables else None
    effective_workspace_parts = activity_workspace_parts(p, activity, activity_problem)
    resp.workspace_parts = effective_workspace_parts
    from app.schemas import SqlCheckInfo
    solutions = stored_solutions(db, p.id)
    resp.sql_checks = [SqlCheckInfo(id=row.id, name=row.name, timeLimitMs=row.time_limit_ms)
                       for row in solutions if row.enabled and row.query.strip()]
    if current_user.role in ["instructor", "admin"]:
        resp.sql_solutions = [solution_response(row) for row in solutions] or None
    resp.progress = progress
    if activity and current_user.role == "student" and not activity.hints_enabled:
        resp.hint = None
    
    from app.models import TestCase, TestCaseScript
    tcs = db.query(TestCase).filter(TestCase.problem_id == p.id).order_by(TestCase.order_index).all()
    if current_user.role == "student":
        from app.schemas import ExpectedOutputSample
        resp.expected_samples = [
            ExpectedOutputSample(dataset=index + 1, table=expected_output_tables[index])
            for index, tc in enumerate(tcs)
            if expected_output_visible and not tc.is_hidden and index < len(expected_output_tables)
        ]
        resp.expected = resp.expected_samples[0].table if resp.expected_samples else None
        # Only visible sample outputs reach the student. Hidden answers remain
        # stored on the problem for grading.
        resp.expected_outputs = []

    if tcs:
        mapped_tcs = []
        for idx, tc in enumerate(tcs):
            if tc.is_hidden and current_user.role == "student":
                continue
            script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).first()
            if script:
                mapped_tcs.append({
                    "schema": script.create_script,
                    "seedData": script.insert_script,
                    "isHidden": tc.is_hidden
                })
                if len(mapped_tcs) == 1:
                    resp.schema_sql = script.create_script
                    resp.seed_data = script.insert_script
                    if current_user.role in ["instructor", "admin"]:
                        resp.reference_solution = tc.expected_query or ""
                    else:
                        resp.reference_solution = ""
        resp.test_cases = mapped_tcs
        
    if current_user.role == "student" and "DDL" in effective_workspace_parts:
        resp.schema_sql = ""
        for case in resp.test_cases or []:
            case["schema"] = ""
    return resp

@router.put("/{problem_id}", response_model=ProblemDetailResponse)
def update_problem(problem_id: str, problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only instructors and administrators can edit problems.")
        
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
    p.schema_file_name = problem.schema_file_name
    if problem.expected_outputs is not None:
        p.expected = save_expected_outputs(problem.expected_outputs, problem.expected_output_visible)
    if problem.workspace_parts is not None:
        p.workspace_parts = problem.workspace_parts
    save_solutions(db, problem_id, problem.sql_solutions)
    
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
    return get_problem(problem_id, db=db, current_user=current_user)

@router.delete("/{problem_id}")
def delete_problem(problem_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only instructors and administrators can delete problems.")
        
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    if p.creator_id and p.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't have permission to delete this problem.")
        
    from app.models import ProblemTopic, TestCase, TestCaseScript, Submission, ProblemDraft, Favorite, ProblemListItem, AiChatSession, AssignmentProblem, ProblemSqlSolution
    
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
    
    db.query(ProblemSqlSolution).filter(ProblemSqlSolution.problem_id == problem_id).delete()
    db.delete(p)
    db.commit()
    return {"message": "Deleted successfully"}

@router.post("", response_model=ProblemDetailResponse)
def create_problem(problem: ProblemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only instructors and administrators can create problems.")
        
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
        schema_file_name=problem.schema_file_name,
        workspace_parts=problem.workspace_parts or ["SQL"],
        expected=save_expected_outputs(problem.expected_outputs, problem.expected_output_visible) if problem.expected_outputs is not None else None,
        creator_id=current_user.id
    )
    db.add(new_prob)
    db.flush()
    save_solutions(db, prob_id, problem.sql_solutions)
    
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
    
    resp = get_problem(prob_id, db=db, current_user=current_user)
    resp.progress = "Not started"
    return resp

@router.post("/validate")
def validate_problem_solution(request: ProblemValidateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only instructors can validate reference solutions.")
        
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
        
    effective_workspace_parts = p.workspace_parts or ["SQL"]
    if request.source in ["Assignments", "Contests"]:
        activity, activity_problem = activity_problem_access(db, current_user, p.id, request.context, request.source)
        from app.routers.activity_attempts import require_open_exam
        require_open_exam(db, current_user, activity)
        effective_workspace_parts = activity_workspace_parts(p, activity, activity_problem)
    elif not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to run this problem.")

    if effective_workspace_parts != ["SQL"]:
        raise HTTPException(status_code=400, detail="Use the workspace to run multi-section problems. Combined submissions are not supported by the SQL-only grader.")
        
    result = run_sandbox(db, p, request.query, is_submit=False)
    return result

@router.post("/{problem_id}/submit")
def submit_query(problem_id: str, request: QueryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.submission_policy import check_submission_limit, submission_receipt
    activity = None
    used = None
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    effective_workspace_parts = p.workspace_parts or ["SQL"]

    if request.source not in ["Assignments", "Contests"] and not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to submit this problem.")
        
    max_score = 100
    
    if not p.practice_listed:
        if request.source not in ["Assignments", "Contests"] or not request.context:
            raise HTTPException(status_code=403, detail="This problem requires submission through a valid assignment.")
            
    if request.source in ["Assignments", "Contests"]:
        activity, ap = activity_problem_access(db, current_user, p.id, request.context,
                                               request.source, for_submit=True)
        from app.routers.activity_attempts import require_open_exam
        require_open_exam(db, current_user, activity)
        if activity.exam_mode and current_user.role == "student":
            raise HTTPException(403, "Use Submit & Exit to submit the complete exam.")
        max_score = ap.points
        effective_workspace_parts = activity_workspace_parts(p, activity, ap)

    if effective_workspace_parts != ["SQL"]:
        raise HTTPException(status_code=400, detail="Use the workspace to submit multi-section problems. Combined submissions are not supported by the SQL-only grader.")
    if activity:
        used = check_submission_limit(db, current_user, activity, p.id)
                
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
    
    today = datetime.datetime.utcnow().date()
    last_date = current_user.last_streak_date.date() if current_user.last_streak_date else None
    
    if last_date != today:
        if last_date == today - datetime.timedelta(days=1):
            current_user.current_streak = (current_user.current_streak or 0) + 1
            
            # Milestone Notification (e.g. 3, 5, 7, 10, 30, 50, 100...)
            milestones = [3, 5, 7, 10, 30, 50, 100, 365]
            if current_user.current_streak in milestones or (current_user.current_streak > 10 and current_user.current_streak % 10 == 0):
                from app.models import Notification
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    title="Learning streak milestone!",
                    message=f"🔥 Congratulations! Your learning streak has reached {current_user.current_streak} days. Keep it up!",
                    type="Milestone",
                    link="/practice"
                )
                db.add(notif)
        else:
            current_user.current_streak = 1
            
        current_user.last_streak_date = datetime.datetime.utcnow()
        if current_user.current_streak > (current_user.longest_streak or 0):
            current_user.longest_streak = current_user.current_streak
            
    db.commit()
    
    if activity and not activity.show_scores_after_submit:
        result = {"status": "Submitted", "message": "Your submission was saved. Scores are hidden by your instructor."}
    result.update(submission_receipt(activity, used, score, max_score))
    return result



@router.post("/{problem_id}/workspace/run")
def run_problem_workspace(problem_id: str, request: "WorkspaceRunRequest", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.problem_workspace import run_workspace
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
    effective_workspace_parts = p.workspace_parts or ["SQL"]
    if request.source in ["Assignments", "Contests"]:
        activity, activity_problem = activity_problem_access(db, current_user, p.id, request.context, request.source)
        from app.routers.activity_attempts import require_open_exam
        require_open_exam(db, current_user, activity)
        effective_workspace_parts = activity_workspace_parts(p, activity, activity_problem)
    elif not check_problem_access(db, current_user, p):
        raise HTTPException(status_code=403, detail="You don't have permission to run this problem.")
    enabled = effective_workspace_parts
    if request.part not in enabled:
        raise HTTPException(status_code=400, detail="This section is not enabled for this problem.")
    from app.models import TestCase, TestCaseScript
    tc = db.query(TestCase).filter(TestCase.problem_id == p.id, TestCase.is_hidden == False).order_by(TestCase.order_index).first()
    script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).first() if tc else None
    solutions = stored_solutions(db, p.id) if request.part == "SQL" else []
    limits = [row.time_limit_ms for row in solutions if row.enabled and row.query.strip()] if solutions else None
    if limits == []:
        raise HTTPException(status_code=400, detail="No enabled SQL solution has been configured for this problem.")
    return run_workspace(db.get_bind(), enabled, request,
                         script.create_script if script else "",
                         script.insert_script if script else "", sql_time_limits=limits)


@router.post("/{problem_id}/workspace/submit")
def submit_workspace(problem_id: str, request: WorkspaceRunRequest,
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.routers.activity_attempts import store_submission
    from app.services.submission_policy import check_submission_limit, submission_receipt, scores_visible
    activity = None
    used = None
    maximum = 100
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found.")
    parts = p.workspace_parts or ["SQL"]
    if request.source in ["Assignments", "Contests"]:
        activity, member = activity_problem_access(db, current_user, p.id, request.context, request.source, for_submit=True)
        if activity.exam_mode and current_user.role == "student":
            raise HTTPException(403, "Use Submit & Exit to submit the complete exam.")
        parts = activity_workspace_parts(p, activity, member)
    elif not check_problem_access(db, current_user, p):
        raise HTTPException(403, "You cannot submit this problem.")
    if current_user.role != "student":
        raise HTTPException(403, "Only students can submit work.")
    if parts == ["SQL"]:
        raise HTTPException(400, "Use the SQL submission endpoint for SQL-only work.")
    if activity:
        used = check_submission_limit(db, current_user, activity, p.id)
        maximum = member.points
    scripts = {"ddl": request.ddl, "dml": request.dml, "query": request.query}
    sub = store_submission(db, current_user.id, p, request.source, request.context,
                           scripts, parts, maximum=maximum)
    db.commit()
    visible = scores_visible(activity)
    return {"status": sub.result if visible else "Submitted",
            "message": (sub.feedback or "Your submission has been saved.") if visible
                        else "Your submission has been saved. Scores are hidden by your instructor.",
            **submission_receipt(activity, used, score=sub.score, maximum=maximum)}
