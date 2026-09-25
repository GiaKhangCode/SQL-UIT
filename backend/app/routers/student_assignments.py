from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Class, ClassEnrollment, Assignment, AssignmentClass, AssignmentProblem, Submission
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("")
def get_student_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Lấy các lớp sinh viên đang học
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).all()
    class_ids = [e.class_id for e in enrollments]
    
    # 2. Lấy thông tin chi tiết các lớp đó
    student_classes = db.query(Class).filter(Class.id.in_(class_ids)).all()
    classes_res = []
    for c in student_classes:
        instructor = db.query(User).filter(User.id == c.instructor_id).first()
        classes_res.append({
            "id": c.id,
            "code": f"{c.course} · {c.term}",
            "name": c.course,
            "lecturer": instructor.name if instructor else "",
            "mode": c.mode
        })
        
    # 3. Lấy assignments của các lớp này
    if not class_ids:
        return {"classes": [], "groups": [], "assignments": [], "deadlines": []}
        
    assignment_classes = db.query(AssignmentClass).filter(AssignmentClass.class_id.in_(class_ids)).all()
    assignment_ids = [ac.assignment_id for ac in assignment_classes]
    
    if not assignment_ids:
        return {"classes": classes_res, "groups": [], "assignments": [], "deadlines": []}
        
    student_assignments = db.query(Assignment).filter(Assignment.id.in_(assignment_ids), Assignment.published == True).all()
    
    assignments_res = []
    deadlines_res = []
    
    for a in student_assignments:
        a_c = [ac for ac in assignment_classes if ac.assignment_id == a.id]
        primary_class_id = a_c[0].class_id if a_c else ""
        
        a_problems = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == a.id).order_by(AssignmentProblem.order_index).all()
        p_ids = [ap.problem_id for ap in a_problems]
        
        subs = db.query(Submission).filter(Submission.user_id == current_user.id, Submission.problem_id.in_(p_ids)).all()
        solved_count = len(set([s.problem_id for s in subs if s.result == "Accepted"]))
        attempted_count = len(set([s.problem_id for s in subs]))
        
        if len(p_ids) > 0 and solved_count == len(p_ids):
            status = "Solved"
        elif attempted_count > 0:
            status = "In progress"
        else:
            status = "Not started"
            
        assignments_res.append({
            "id": a.id,
            "title": a.title,
            "classId": primary_class_id,
            "groupId": None, 
            "date": a.closes.strftime("%Y-%m-%d") if a.closes else "",
            "time": a.closes.strftime("%H:%M") if a.closes else "",
            "status": status,
            "problemIds": p_ids
        })
        
        if a.closes and status != "Solved":
            primary_class = next((c for c in classes_res if c["id"] == primary_class_id), None)
            context = primary_class["name"] if primary_class else ""
            if not a.is_contest:
                deadlines_res.append({
                    "id": a.id,
                    "title": a.title,
                    "date": a.closes.strftime("%Y-%m-%d"),
                    "time": a.closes.strftime("%H:%M"),
                    "kind": "Assignment",
                    "context": context + " · " + (a.format if a.format else "Individual"),
                    "to": "/assignments?work=" + a.id
                })
            else:
                deadlines_res.append({
                    "id": a.id,
                    "title": a.title,
                    "date": a.closes.strftime("%Y-%m-%d"),
                    "time": a.closes.strftime("%H:%M"),
                    "kind": "Contest",
                    "context": context,
                    "to": "/contests/" + a.id
                })
                
    deadlines_res.sort(key=lambda x: (x["date"], x["time"]))
    
    # 4. Fetch the problem details for frontend rendering
    from app.models import Problem
    all_p_ids = set()
    for a in assignments_res:
        for p_id in a["problemIds"]:
            all_p_ids.add(p_id)
            
    problems_db = db.query(Problem).filter(Problem.id.in_(list(all_p_ids))).all() if all_p_ids else []
    problems_res = []
    for p in problems_db:
        sub = db.query(Submission).filter(Submission.user_id == current_user.id, Submission.problem_id == p.id).order_by(Submission.submitted_at.desc()).first()
        progress = "Not started"
        if sub:
            progress = "Solved" if sub.result == "Accepted" else "In progress"
            
        problems_res.append({
            "id": p.id,
            "title": p.title,
            "topic": p.topic,
            "difficulty": p.difficulty,
            "progress": progress
        })
    
    return {
        "classes": classes_res,
        "groups": [],
        "assignments": assignments_res,
        "deadlines": deadlines_res,
        "problems": problems_res
    }
