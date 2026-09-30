from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import datetime
import json
import math
from pathlib import Path
import re

from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User, Assignment, AssignmentClass, AssignmentProblem, Class, ClassEnrollment
from app.schemas import AssignmentCreate, AssignmentResponse

router = APIRouter(
    prefix="/api/assignments",
    tags=["Assignments"]
)

BANNER_DIR = Path(__file__).resolve().parents[2] / "uploads" / "contest-banners"
BANNER_URL = "/api/assignments/banners/"
BANNER_NAME = re.compile(r"^[0-9a-f]{32}\.webp$")


def validate_banner_fields(assignment: AssignmentCreate):
    fields = (assignment.banner_url, assignment.banner_source_url, assignment.banner_crop)
    if not assignment.is_contest and any(fields):
        raise HTTPException(status_code=400, detail="Banner images are for contests only.")
    for url in fields[:2]:
        if url and not (url.startswith(BANNER_URL) and BANNER_NAME.fullmatch(url[len(BANNER_URL):])
                        and (BANNER_DIR / url[len(BANNER_URL):]).is_file()):
            raise HTTPException(status_code=400, detail="Invalid contest banner reference.")
    if bool(assignment.banner_url) != bool(assignment.banner_source_url):
        raise HTTPException(status_code=400, detail="Contest banner and source must be provided together.")
    if assignment.banner_crop:
        if not assignment.banner_url or len(assignment.banner_crop) > 160:
            raise HTTPException(status_code=400, detail="Invalid contest banner crop.")
        try:
            crop = json.loads(assignment.banner_crop)
            values = (crop["x"], crop["y"], crop["zoom"])
            if not all(isinstance(value, (float, int)) and math.isfinite(value) for value in values):
                raise ValueError()
            if not (0 <= crop["x"] <= 1 and 0 <= crop["y"] <= 1 and 1 <= crop["zoom"] <= 3):
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid contest banner crop.")


async def save_banner_file(file: UploadFile, max_bytes: int) -> str:
    if file.content_type != "image/webp":
        raise HTTPException(status_code=400, detail="Banner crop must be a WebP image.")
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes or len(data) < 16:
        raise HTTPException(status_code=400, detail="Banner image exceeds the upload limit or is empty.")
    if (data[:4] != b"RIFF" or data[8:12] != b"WEBP" or
            int.from_bytes(data[4:8], "little") != len(data) - 8 or
            data[12:16] not in (b"VP8 ", b"VP8L", b"VP8X")):
        raise HTTPException(status_code=400, detail="Invalid WebP image.")
    BANNER_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.webp"
    (BANNER_DIR / filename).write_bytes(data)
    return BANNER_URL + filename


@router.post("/banners")
async def upload_contest_banner(banner: UploadFile = File(...), source: UploadFile = File(...),
                                current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can upload contest banners.")
    banner_url = await save_banner_file(banner, 4 * 1024 * 1024)
    try:
        source_url = await save_banner_file(source, 6 * 1024 * 1024)
    except Exception:
        (BANNER_DIR / banner_url[len(BANNER_URL):]).unlink(missing_ok=True)
        raise
    return {"bannerUrl": banner_url, "bannerSourceUrl": source_url}


@router.get("/banners/{filename}")
def get_contest_banner(filename: str):
    if not BANNER_NAME.fullmatch(filename):
        raise HTTPException(status_code=404, detail="Banner not found.")
    path = BANNER_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Banner not found.")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})

def validate_assignment_classes(assignment: AssignmentCreate, db: Session, current_user: User):
    validate_banner_fields(assignment)
    if assignment.published and (not assignment.problems or
                                 (assignment.audience_type == "classes" and not assignment.class_ids)):
        raise HTTPException(status_code=400, detail="Published activities need an audience and at least one problem.")
    if assignment.published and assignment.is_contest and not all((
        assignment.short_description.strip(), assignment.description.strip(), assignment.rules.strip()
    )):
        raise HTTPException(status_code=400, detail="Published contests need a short description, description, and rules.")
    if assignment.opens >= assignment.closes:
        raise HTTPException(status_code=400, detail="End time must be after start time.")
    if assignment.is_contest and assignment.audience_type == "all_students" and assignment.class_ids:
        raise HTTPException(status_code=400, detail="All-students contests cannot select classes.")
    if len(set(assignment.class_ids)) != len(assignment.class_ids):
        raise HTTPException(status_code=400, detail="Each class can be selected only once.")
    if not assignment.class_ids:
        return
    query = db.query(Class.id).filter(Class.id.in_(assignment.class_ids), Class.status == "Active")
    if current_user.role == "instructor":
        query = query.filter(Class.instructor_id == current_user.id)
    if query.count() != len(assignment.class_ids):
        raise HTTPException(status_code=400, detail="One or more selected classes are unavailable.")


def eligible_student_ids(db: Session, audience_type: str, class_ids: List[str]) -> List[str]:
    query = db.query(User.id).filter(User.role == "student", User.status == "Active")
    if audience_type == "classes":
        if not class_ids:
            return []
        query = query.join(ClassEnrollment, ClassEnrollment.student_id == User.id).filter(
            ClassEnrollment.class_id.in_(class_ids)
        )
    return [row[0] for row in query.distinct().all()]


@router.get("/audience-count")
def get_audience_count(audience_type: str = "classes", class_ids: List[str] = Query(default=[]),
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can view audience counts.")
    if audience_type not in ["classes", "all_students"]:
        raise HTTPException(status_code=400, detail="Invalid audience type.")
    if audience_type == "classes" and class_ids:
        query = db.query(Class.id).filter(Class.id.in_(class_ids), Class.status == "Active")
        if current_user.role == "instructor":
            query = query.filter(Class.instructor_id == current_user.id)
        if query.count() != len(set(class_ids)):
            raise HTTPException(status_code=400, detail="One or more selected classes are unavailable.")
    return {"eligibleStudents": len(eligible_student_ids(db, audience_type, class_ids))}

@router.post("", response_model=AssignmentResponse)
def create_assignment(assignment: AssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền tạo assignment/contest.")
        
    validate_assignment_classes(assignment, db, current_user)
            
    assignment_id = str(uuid.uuid4())
    new_assignment = Assignment(
        id=assignment_id,
        title=assignment.title,
        is_contest=assignment.is_contest,
        audience_type=assignment.audience_type,
        short_description=assignment.short_description if assignment.is_contest else "",
        description=assignment.description if assignment.is_contest else "",
        rules=assignment.rules if assignment.is_contest else "",
        banner_url=assignment.banner_url if assignment.is_contest else None,
        banner_source_url=assignment.banner_source_url if assignment.is_contest else None,
        banner_crop=assignment.banner_crop if assignment.is_contest else None,
        instructions=assignment.instructions,
        opens=assignment.opens,
        closes=assignment.closes,
        published=assignment.published,
        hints_enabled=assignment.student_options.hints if not assignment.is_contest else False,
        comments_enabled=assignment.student_options.comments if not assignment.is_contest else False,
        leaderboard_enabled=assignment.student_options.leaderboard if assignment.is_contest else False,
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
    
    if assignment.published:
        student_ids = eligible_student_ids(db, assignment.audience_type, assignment.class_ids)
        if student_ids:
            from app.models import Notification
            new_notifs = [
                Notification(
                    id=str(uuid.uuid4()),
                    user_id=s_id,
                    title=f"{'Kỳ thi' if assignment.is_contest else 'Bài tập'} mới: {assignment.title}",
                    message="Giảng viên đã giao một bài mới. Hãy kiểm tra ngay!",
                    type="Assignment",
                    link=f"/{'contests' if assignment.is_contest else 'assignments'}"
                )
                for s_id in student_ids
            ]
            db.bulk_save_objects(new_notifs)
            db.commit()
    
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
        audience_type = a.audience_type or "classes"
        class_str = "All students" if a.is_contest and audience_type == "all_students" else ", ".join(class_ids) if class_ids else "No classes"
        problems_list = [{"id": p.problem_id, "points": p.points} for p in problems]
        
        # Calculate total students assigned
        student_ids = eligible_student_ids(db, audience_type, class_ids)
        total_students = len(student_ids)
            
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
            
            latest_subs_subquery = db.query(
                Submission.user_id,
                Submission.problem_id,
                func.max(Submission.submitted_at).label('max_time')
            ).filter(
                Submission.user_id.in_(student_ids),
                Submission.problem_id.in_(problem_ids),
                Submission.context == a.id,
                Submission.source.in_(["Assignments", "Contests"])
            ).group_by(Submission.user_id, Submission.problem_id).subquery()
            
            latest_submissions_query = db.query(Submission).join(
                latest_subs_subquery,
                (Submission.user_id == latest_subs_subquery.c.user_id) &
                (Submission.problem_id == latest_subs_subquery.c.problem_id) &
                (Submission.submitted_at == latest_subs_subquery.c.max_time)
            ).filter(Submission.context == a.id)
            
            awaiting_query = latest_submissions_query.filter(Submission.evaluated_score == None)
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
            "audienceType": audience_type,
            "shortDescription": a.short_description or "",
            "description": a.description or "",
            "rules": a.rules or "",
            "bannerUrl": a.banner_url if a.is_contest else None,
            "bannerSourceUrl": a.banner_source_url if a.is_contest else None,
            "bannerCrop": a.banner_crop if a.is_contest else None,
            "eligibleStudents": total_students,
            "classes": class_str,
            "problems": len(problems),
            "due": due,
            "submitted": submitted_str,
            "average": f"{avg_score}%",
            "awaiting": awaiting,
            "reviewId": review_id,
            "status": status,
            "instructions": a.instructions or "",
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
        if current_user.status != "Active":
            raise HTTPException(status_code=403, detail="This activity is available to active students only.")
        if not a.published:
            raise HTTPException(status_code=403, detail="Bài tập này chưa được công bố.")
        if not (a.is_contest and a.audience_type == "all_students") and class_ids:
            from app.models import ClassEnrollment
            enrollment = db.query(ClassEnrollment).filter(
                ClassEnrollment.student_id == current_user.id,
                ClassEnrollment.class_id.in_(class_ids)
            ).first()
            if not enrollment:
                raise HTTPException(status_code=403, detail="Bạn không thuộc lớp được giao bài tập này.")
        elif not (a.is_contest and a.audience_type == "all_students"):
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
    audience_type = a.audience_type or "classes"
    class_str = "All students" if a.is_contest and audience_type == "all_students" else ", ".join(class_ids) if class_ids else "No classes"
    
    from app.models import ClassEnrollment, Submission
    
    student_ids = eligible_student_ids(db, audience_type, class_ids)
    total_students = len(student_ids)
        
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
        "audienceType": audience_type,
        "shortDescription": a.short_description or "",
        "description": a.description or "",
        "rules": a.rules or "",
        "bannerUrl": a.banner_url if a.is_contest else None,
        "bannerSourceUrl": a.banner_source_url if a.is_contest and current_user.role in ("instructor", "admin") else None,
        "bannerCrop": a.banner_crop if a.is_contest and current_user.role in ("instructor", "admin") else None,
        "eligibleStudents": total_students,
        "classes": class_str,
        "problems": len(problems),
        "due": due,
        "submitted": submitted_str,
        "average": f"{avg_score}%",
        "awaiting": awaiting,
        "reviewId": review_id,
        "status": status,
        "instructions": a.instructions or "",
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
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền sửa assignment/contest.")
        
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if current_user.role == "instructor" and a.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this assignment.")
    validate_assignment_classes(assignment, db, current_user)
        
    was_published = a.published
    a.title = assignment.title
    a.is_contest = assignment.is_contest
    a.audience_type = assignment.audience_type
    a.short_description = assignment.short_description if assignment.is_contest else ""
    a.description = assignment.description if assignment.is_contest else ""
    a.rules = assignment.rules if assignment.is_contest else ""
    a.banner_url = assignment.banner_url if assignment.is_contest else None
    a.banner_source_url = assignment.banner_source_url if assignment.is_contest else None
    a.banner_crop = assignment.banner_crop if assignment.is_contest else None
    a.instructions = assignment.instructions
    a.opens = assignment.opens
    a.closes = assignment.closes
    a.published = assignment.published
    a.hints_enabled = assignment.student_options.hints if not assignment.is_contest else False
    a.comments_enabled = assignment.student_options.comments if not assignment.is_contest else False
    a.leaderboard_enabled = assignment.student_options.leaderboard if assignment.is_contest else False
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
    
    if not was_published and assignment.published:
        student_ids = eligible_student_ids(db, assignment.audience_type, assignment.class_ids)
        if student_ids:
            from app.models import Notification
            new_notifs = [
                Notification(
                    id=str(uuid.uuid4()),
                    user_id=s_id,
                    title=f"{'Kỳ thi' if assignment.is_contest else 'Bài tập'} mới: {assignment.title}",
                    message="Giảng viên đã giao một bài mới. Hãy kiểm tra ngay!",
                    type="Assignment",
                    link=f"/{'contests' if assignment.is_contest else 'assignments'}"
                )
                for s_id in student_ids
            ]
            db.bulk_save_objects(new_notifs)
            db.commit()
    
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
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên và Admin mới có quyền xóa assignment/contest.")
        
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
        
    from sqlalchemy import func
    latest_subs_subquery = db.query(
        Submission.user_id,
        Submission.problem_id,
        func.max(Submission.submitted_at).label('max_time')
    ).filter(
        Submission.problem_id.in_(problem_ids),
        Submission.context == a.id,
        Submission.source.in_(["Assignment", "Contest", "Assignments", "Contests"])
    ).group_by(Submission.user_id, Submission.problem_id).subquery()
    
    subs = db.query(Submission).join(
        latest_subs_subquery,
        (Submission.user_id == latest_subs_subquery.c.user_id) &
        (Submission.problem_id == latest_subs_subquery.c.problem_id) &
        (Submission.submitted_at == latest_subs_subquery.c.max_time)
    ).filter(Submission.context == a.id).order_by(Submission.submitted_at.desc()).all()
    
    result = []
    for sub in subs:
        user = db.query(User).filter(User.id == sub.user_id).first()
        problem = db.query(Problem).filter(Problem.id == sub.problem_id).first()
        
        result.append(TeacherSubmissionSummary(
            id=sub.id,
            student=user.name if user else "Unknown",
            problem=problem.title if problem else "Unknown",
            score=sub.evaluated_score if sub.evaluated_score is not None else sub.score,
            status="Needs review" if sub.evaluated_score is None else sub.result,
            submittedAt=sub.submitted_at.strftime("%b %d, %H:%M")
        ))
        
    return result
