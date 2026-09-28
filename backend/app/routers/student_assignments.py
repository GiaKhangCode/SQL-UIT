from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime
from app.database import get_db
from app.models import User, Class, ClassEnrollment, Assignment, AssignmentClass, AssignmentProblem, Submission, Problem
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("")
def get_student_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "student" or current_user.status != "Active":
        raise HTTPException(status_code=403, detail="Only active students can view assigned activities.")
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
            "lecturer": instructor.name if instructor else ""
        })
        
    # 3. Lấy assignments của các lớp này
    assignment_classes = db.query(AssignmentClass).filter(AssignmentClass.class_id.in_(class_ids)).all() if class_ids else []
    assignment_ids = {ac.assignment_id for ac in assignment_classes}
    student_assignments = db.query(Assignment).filter(
        Assignment.published == True,
        (Assignment.id.in_(assignment_ids)) |
        ((Assignment.is_contest == True) & (Assignment.audience_type == "all_students"))
    ).all()
    
    assignments_res = []
    deadlines_res = []
    
    for a in student_assignments:
        a_c = [ac for ac in assignment_classes if ac.assignment_id == a.id]
        assigned_class_ids = [ac.class_id for ac in a_c]
        
        now = datetime.datetime.utcnow()
        
        a_problems = db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == a.id).order_by(AssignmentProblem.order_index).all()
        p_ids = [ap.problem_id for ap in a_problems]
        
        is_open = not a.opens or a.opens <= now
        contest_status = ("Upcoming" if a.opens and now < a.opens else
                          "Closed" if a.closes and now >= a.closes else "Live") if a.is_contest else None
        
        subs = db.query(Submission).filter(
            Submission.user_id == current_user.id, 
            Submission.problem_id.in_(p_ids), 
            Submission.context == a.id,
            Submission.source.in_(["Assignments", "Contests"])
        ).all()
        solved_count = len(set([s.problem_id for s in subs if s.result == "Accepted"]))
        attempted_count = len(set([s.problem_id for s in subs]))
        
        if len(p_ids) > 0 and solved_count == len(p_ids):
            status = "Solved"
        elif attempted_count > 0:
            status = "In progress"
        else:
            status = "Not started"
            
        problem_progress = {}
        for p_id in p_ids:
            p_subs = [s for s in subs if s.problem_id == p_id]
            if not p_subs:
                problem_progress[p_id] = "Not started"
            elif any(s.result == "Accepted" for s in p_subs):
                problem_progress[p_id] = "Solved"
            else:
                problem_progress[p_id] = "In progress"

        score = sum(
            min(ap.points, max((s.evaluated_score if s.evaluated_score is not None else s.score
                                for s in subs if s.problem_id == ap.problem_id), default=0))
            for ap in a_problems
        )
        submitters = 0
        leaderboard = []
        rank = None
        if a.is_contest and is_open:
            from app.routers.assignments import eligible_student_ids
            contest_class_ids = [row.class_id for row in db.query(AssignmentClass).filter(AssignmentClass.assignment_id == a.id).all()]
            eligible_ids = eligible_student_ids(db, a.audience_type or "classes", contest_class_ids)
            contest_subs = db.query(Submission).filter(
                Submission.context == a.id, Submission.source == "Contests",
                Submission.user_id.in_(eligible_ids), Submission.problem_id.in_(p_ids)
            ).all() if eligible_ids and p_ids else []
            score_by_user = {}
            point_limits = {ap.problem_id: ap.points for ap in a_problems}
            for sub in contest_subs:
                user_scores = score_by_user.setdefault(sub.user_id, {})
                points = sub.evaluated_score if sub.evaluated_score is not None else sub.score
                user_scores[sub.problem_id] = max(user_scores.get(sub.problem_id, 0),
                                                  min(point_limits[sub.problem_id], points))
            submitters = len(score_by_user)
            if a.leaderboard_enabled and score_by_user:
                names = {u.id: u.name for u in db.query(User).filter(User.id.in_(score_by_user)).all()}
                ranked = sorted(((user_id, sum(points.values())) for user_id, points in score_by_user.items()),
                                key=lambda row: (-row[1], names.get(row[0], "")))
                previous_score = None
                current_rank = 0
                for position, (user_id, total) in enumerate(ranked, start=1):
                    if total != previous_score:
                        current_rank = position
                        previous_score = total
                    if user_id == current_user.id:
                        rank = current_rank
                    if position <= 10:
                        leaderboard.append({"rank": current_rank, "student": names.get(user_id, "Student"), "score": total})
            
        assignments_res.append({
            "id": a.id,
            "title": a.title,
            "instructions": a.instructions or "",
            "classIds": assigned_class_ids,
            "date": a.closes.strftime("%Y-%m-%d") if a.closes else "",
            "time": a.closes.strftime("%H:%M") if a.closes else "",
            "status": status,
            "problemIds": p_ids if is_open else [],
            "problemDetails": ([{"id": p.id, "title": p.title, "difficulty": p.difficulty, "topic": p.topic,
                                 "points": next((ap.points for ap in a_problems if ap.problem_id == p.id), 0)}
                                for p in db.query(Problem).filter(Problem.id.in_(p_ids)).all()] if is_open and a.is_contest else []),
            "problemCount": len(p_ids),
            "problemProgress": problem_progress if is_open else {},
            "isContest": a.is_contest,
            "audienceType": a.audience_type or "classes",
            "scope": "All students" if a.is_contest and a.audience_type == "all_students" else ", ".join(c["name"] for c in classes_res if c["id"] in assigned_class_ids),
            "shortDescription": a.short_description or "",
            "description": a.description or "",
            "rules": a.rules or "",
            "bannerUrl": a.banner_url if a.is_contest else None,
            "opens": a.opens.isoformat() if a.opens else None,
            "closes": a.closes.isoformat() if a.closes else None,
            "contestStatus": contest_status,
            "leaderboardEnabled": bool(a.leaderboard_enabled) if a.is_contest else False,
            "aiAllowed": bool(a.ai_allowed),
            "totalPoints": sum(ap.points for ap in a_problems),
            "score": score,
            "submitters": submitters,
            "rank": rank,
            "leaderboard": leaderboard,
        })
        
        if a.closes and status != "Solved":
            context = assignments_res[-1]["scope"]
            if not a.is_contest:
                deadlines_res.append({
                    "id": a.id,
                    "title": a.title,
                    "date": a.closes.strftime("%Y-%m-%d"),
                    "time": a.closes.strftime("%H:%M"),
                    "kind": "Assignment",
                    "context": context,
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
    all_p_ids = set()
    for a in assignments_res:
        for p_id in a["problemIds"]:
            all_p_ids.add(p_id)
            
    problems_db = db.query(Problem).filter(Problem.id.in_(list(all_p_ids))).all() if all_p_ids else []
    problems_res = []
    for p in problems_db:
        problems_res.append({
            "id": p.id,
            "title": p.title,
            "topic": p.topic,
            "difficulty": p.difficulty
        })
    
    return {
        "classes": classes_res,
        "assignments": assignments_res,
        "deadlines": deadlines_res,
        "problems": problems_res
    }
