from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import datetime

from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User, Assignment, AssignmentClass, AssignmentProblem, Class
from app.schemas import AssignmentCreate, AssignmentResponse

router = APIRouter(
    prefix="/api/assignments",
    tags=["Assignments"]
)

@router.post("", response_model=AssignmentResponse)
def create_assignment(assignment: AssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền tạo assignment/contest.")
        
    assignment_id = str(uuid.uuid4())
    new_assignment = Assignment(
        id=assignment_id,
        title=assignment.title,
        is_contest=assignment.is_contest,
        format=assignment.format,
        instructions=assignment.instructions,
        opens=assignment.opens,
        closes=assignment.closes,
        published=assignment.published,
        hints_enabled=assignment.student_options.hints,
        comments_enabled=assignment.student_options.comments,
        leaderboard_enabled=assignment.student_options.leaderboard,
        ai_allowed=assignment.student_options.ai_allowed,
        instructor_id=current_user.id
    )
    db.add(new_assignment)
    
    for c_id in assignment.class_ids:
        ac = AssignmentClass(
            id=str(uuid.uuid4()),
            assignment_id=assignment_id,
            class_id=c_id
        )
        db.add(ac)
        
    for i, p in enumerate(assignment.problems):
        ap = AssignmentProblem(
            id=str(uuid.uuid4()),
            assignment_id=assignment_id,
            problem_id=p.id,
            points=p.points,
            order_index=i
        )
        db.add(ap)
        
    db.commit()
    db.refresh(new_assignment)
    
    from app.models import ActivityLog
    action_text = f"Created {'contest' if assignment.is_contest else 'assignment'} '{assignment.title}'"
    log = ActivityLog(
        id=str(uuid.uuid4()),
        action=action_text,
        user_id=current_user.id
    )
    db.add(log)
    db.commit()
    
    return get_assignment(assignment_id, db, current_user)

@router.get("", response_model=List[AssignmentResponse])
def get_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "instructor":
        assignments = db.query(Assignment).filter(Assignment.instructor_id == current_user.id).all()
    elif current_user.role == "admin":
        assignments = db.query(Assignment).all()
    else:
        raise HTTPException(status_code=403, detail="Sinh viên không có quyền gọi API quản lý này.")
        
    res = []
    now = datetime.datetime.utcnow()
    
    from app.models import ClassEnrollment, Submission
    
    for a in assignments:
        classes = db.query(AssignmentClass).filter(AssignmentClass.assignment_id == a.id).all()
        class_ids = [c.class_id for c in classes]
        problems = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == a.id).all()
        problem_ids = [p.problem_id for p in problems]
        
        # Determine status
        if not a.published:
            status = "Draft"
        elif a.opens and a.opens > now:
            status = "Scheduled"
        elif a.closes and a.closes < now:
            status = "Closed"
        else:
            status = "Open"
            
        due = a.closes.strftime("%b %d") if a.closes else ""
        class_str = ", ".join(class_ids) if class_ids else "No classes"
        problems_list = [{"id": p.problem_id, "points": p.points} for p in problems]
        
        # Calculate total students assigned
        if class_ids:
            total_students_query = db.query(ClassEnrollment.student_id).filter(ClassEnrollment.class_id.in_(class_ids)).distinct().all()
            total_students = len(total_students_query)
            student_ids = [s[0] for s in total_students_query]
        else:
            total_students = 0
            student_ids = []
            
        # Calculate how many students have attempted at least one problem
        if student_ids and problem_ids:
            submitted_students_query = db.query(Submission.user_id).filter(
                Submission.user_id.in_(student_ids),
                Submission.problem_id.in_(problem_ids),
                Submission.context == a.id,
                Submission.source.in_(["Assignments", "Contests"])
            ).distinct().all()
            submitted_students = len(submitted_students_query)
        else:
            submitted_students = 0
            
        # Calculate average score, awaiting review, and get a review_id
        from sqlalchemy import func
        if submitted_students > 0:
            max_scores_subquery = db.query(
                func.max(func.coalesce(Submission.evaluated_score, Submission.score)).label('max_score')
            ).filter(
                Submission.user_id.in_(student_ids),
                Submission.problem_id.in_(problem_ids),
                Submission.context == a.id,
                Submission.source.in_(["Assignments", "Contests"])
            ).group_by(Submission.user_id, Submission.problem_id).subquery()
            
            avg_score_query = db.query(func.avg(max_scores_subquery.c.max_score)).scalar()
            avg_score = int(avg_score_query) if avg_score_query else 0
            
            awaiting_query = db.query(Submission).filter(
                Submission.user_id.in_(student_ids),
                Submission.problem_id.in_(problem_ids),
                Submission.context == a.id,
                Submission.source.in_(["Assignments", "Contests"]),
                Submission.evaluated_score == None
            )
            awaiting = awaiting_query.count()
            first_awaiting = awaiting_query.first()
            review_id = first_awaiting.id if first_awaiting else None
        else:
            avg_score = 0
            awaiting = 0
            review_id = None
            
        submitted_str = f"{submitted_students}/{total_students}"
        
        res.append({
            "id": a.id,
            "title": a.title,
            "isContest": a.is_contest,
            "classes": class_str,
            "problems": len(problems),
            "due": due,
            "submitted": submitted_str,
            "average": f"{avg_score}%",
            "awaiting": awaiting,
            "reviewId": review_id,
            "status": status,
            "format": a.format,
            "instructions": a.instructions,
            "opens": a.opens,
            "closes": a.closes,
            "published": a.published,
            "studentOptions": {
                "hints": a.hints_enabled,
                "comments": a.comments_enabled,
                "leaderboard": a.leaderboard_enabled,
                "aiAllowed": a.ai_allowed
            },
            "problemList": problems_list,
            "classIds": class_ids
        })
    return res

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if current_user.role == "instructor" and a.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to access this assignment.")
        
    classes = db.query(AssignmentClass).filter(AssignmentClass.assignment_id == a.id).all()
    class_ids = [c.class_id for c in classes]
    
    if current_user.role == "student":
        if not a.published:
            raise HTTPException(status_code=403, detail="Bài tập này chưa được công bố.")
        if class_ids:
            from app.models import ClassEnrollment
            enrollment = db.query(ClassEnrollment).filter(
                ClassEnrollment.student_id == current_user.id,
                ClassEnrollment.class_id.in_(class_ids)
            ).first()
            if not enrollment:
                raise HTTPException(status_code=403, detail="Bạn không thuộc lớp được giao bài tập này.")
        else:
            raise HTTPException(status_code=403, detail="Bài tập này chưa được giao cho bất kỳ lớp nào.")
    problems = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == a.id).order_by(AssignmentProblem.order_index).all()
    problems_list = [{"id": p.problem_id, "points": p.points} for p in problems]
    
    now = datetime.datetime.utcnow()
    
    if current_user.role == "student" and a.opens and now < a.opens:
        problems_list = []
        problems = []
        
    if not a.published:
        status = "Draft"
    elif a.opens and a.opens > now:
        status = "Scheduled"
    elif a.closes and a.closes < now:
        status = "Closed"
    else:
        status = "Open"
    
    due = a.closes.strftime("%b %d") if a.closes else ""
    class_str = ", ".join(class_ids) if class_ids else "No classes"
    
    from app.models import ClassEnrollment, Submission
    
    if class_ids:
        total_students_query = db.query(ClassEnrollment.student_id).filter(ClassEnrollment.class_id.in_(class_ids)).distinct().all()
        total_students = len(total_students_query)
        student_ids = [s[0] for s in total_students_query]
    else:
        total_students = 0
        student_ids = []
        
    problem_ids = [p["id"] for p in problems_list]
    if student_ids and problem_ids:
        submitted_students_query = db.query(Submission.user_id).filter(
            Submission.user_id.in_(student_ids),
            Submission.problem_id.in_(problem_ids),
            Submission.context == a.id,
            Submission.source.in_(["Assignments", "Contests"])
        ).distinct().all()
        submitted_students = len(submitted_students_query)
    else:
        submitted_students = 0
        
    from sqlalchemy import func
    if submitted_students > 0:
        max_scores_subquery = db.query(
            func.max(func.coalesce(Submission.evaluated_score, Submission.score)).label('max_score')
        ).filter(
            Submission.user_id.in_(student_ids),
            Submission.problem_id.in_(problem_ids),
            Submission.context == a.id,
            Submission.source.in_(["Assignments", "Contests"])
        ).group_by(Submission.user_id, Submission.problem_id).subquery()
        
        avg_score_query = db.query(func.avg(max_scores_subquery.c.max_score)).scalar()
        avg_score = int(avg_score_query) if avg_score_query else 0
        
        awaiting_query = db.query(Submission).filter(
            Submission.user_id.in_(student_ids),
            Submission.problem_id.in_(problem_ids),
            Submission.context == a.id,
            Submission.source.in_(["Assignments", "Contests"]),
            Submission.evaluated_score == None
        )
        awaiting = awaiting_query.count()
        first_awaiting = awaiting_query.first()
        review_id = first_awaiting.id if first_awaiting else None
    else:
        avg_score = 0
        awaiting = 0
        review_id = None
        
    submitted_str = f"{submitted_students}/{total_students}"
    
    return {
        "id": a.id,
        "title": a.title,
        "isContest": a.is_contest,
        "classes": class_str,
        "problems": len(problems),
        "due": due,
        "submitted": submitted_str,
        "average": f"{avg_score}%",
        "awaiting": awaiting,
        "reviewId": review_id,
        "status": status,
        "format": a.format,
        "instructions": a.instructions,
        "opens": a.opens,
        "closes": a.closes,
        "published": a.published,
        "studentOptions": {
            "hints": a.hints_enabled,
            "comments": a.comments_enabled,
            "leaderboard": a.leaderboard_enabled,
            "aiAllowed": a.ai_allowed
        },
        "problemList": problems_list,
        "classIds": class_ids
    }

@router.put("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(assignment_id: str, assignment: AssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền sửa assignment/contest.")
        
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if current_user.role == "instructor" and a.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this assignment.")
        
    a.title = assignment.title
    a.is_contest = assignment.is_contest
    a.format = assignment.format
    a.instructions = assignment.instructions
    a.opens = assignment.opens
    a.closes = assignment.closes
    a.published = assignment.published
    a.hints_enabled = assignment.student_options.hints
    a.comments_enabled = assignment.student_options.comments
    a.leaderboard_enabled = assignment.student_options.leaderboard
    a.ai_allowed = assignment.student_options.ai_allowed
    a.updated_at = datetime.datetime.utcnow()
    
    db.query(AssignmentClass).filter(AssignmentClass.assignment_id == assignment_id).delete()
    for c_id in assignment.class_ids:
        ac = AssignmentClass(
            id=str(uuid.uuid4()),
            assignment_id=assignment_id,
            class_id=c_id
        )
        db.add(ac)
        
    db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == assignment_id).delete()
    for i, p in enumerate(assignment.problems):
        ap = AssignmentProblem(
            id=str(uuid.uuid4()),
            assignment_id=assignment_id,
            problem_id=p.id,
            points=p.points,
            order_index=i
        )
        db.add(ap)
        
    db.commit()
    db.refresh(a)
    
    from app.models import ActivityLog
    action_text = f"Updated {'contest' if assignment.is_contest else 'assignment'} '{assignment.title}'"
    log = ActivityLog(
        id=str(uuid.uuid4()),
        action=action_text,
        user_id=current_user.id
    )
    db.add(log)
    db.commit()
    
    return get_assignment(assignment_id, db, current_user)

@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền xóa assignment/contest.")
        
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if current_user.role == "instructor" and a.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this assignment.")
        
    title = a.title
    is_contest = a.is_contest
    
    db.query(AssignmentClass).filter(AssignmentClass.assignment_id == assignment_id).delete()
    db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == assignment_id).delete()
    
    from app.models import Submission
    db.query(Submission).filter(Submission.context == assignment_id).delete()
    
    db.delete(a)
    
    from app.models import ActivityLog
    action_text = f"Deleted {'contest' if is_contest else 'assignment'} '{title}'"
    log = ActivityLog(
        id=str(uuid.uuid4()),
        action=action_text,
        user_id=current_user.id
    )
    db.add(log)
    db.commit()
    
    return {"message": "Deleted successfully"}

from app.schemas import TeacherSubmissionSummary
@router.get("/{assignment_id}/submissions", response_model=List[TeacherSubmissionSummary])
def get_assignment_submissions(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check instructor permission
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if current_user.role != "admin":
        if current_user.role != "instructor" or a.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem danh sách bài nộp của Assignment này.")
        
    classes = db.query(AssignmentClass).filter(AssignmentClass.assignment_id == a.id).all()
    class_ids = [c.class_id for c in classes]
    
    from app.models import ClassEnrollment, Submission, Problem
        
    problems = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == a.id).all()
    problem_ids = [p.problem_id for p in problems]
    
    if not problem_ids:
        return []
        
    subs = db.query(Submission).filter(
        Submission.problem_id.in_(problem_ids),
        Submission.context == a.id,
        Submission.source.in_(["Assignments", "Contests"])
    ).order_by(Submission.submitted_at.desc()).all()
    
    result = []
    for sub in subs:
        user = db.query(User).filter(User.id == sub.user_id).first()
        problem = db.query(Problem).filter(Problem.id == sub.problem_id).first()
        
        result.append(TeacherSubmissionSummary(
            id=sub.id,
            student=user.name if user else "Unknown",
            problem=problem.title if problem else "Unknown",
            score=sub.evaluated_score if sub.evaluated_score is not None else sub.score,
            status="Needs review" if sub.evaluated_score is None else "Accepted",
            submittedAt=sub.submitted_at.strftime("%b %d, %H:%M")
        ))
        
    return result
