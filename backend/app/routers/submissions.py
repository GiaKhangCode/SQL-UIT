from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, Submission, Problem
from app.schemas import SubmissionResponse, TeacherSubmissionResponse
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
        
    if search:
        query = query.join(Problem, Problem.id == Submission.problem_id).filter(Problem.title.ilike(f"%{search}%"))
        
    return query.order_by(Submission.submitted_at.desc()).all()

from pydantic import BaseModel
class ReviewRequest(BaseModel):
    finalScore: int
    feedback: str

@router.get("/{submission_id}", response_model=TeacherSubmissionResponse)
def get_submission(submission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    from fastapi import HTTPException
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if current_user.role != "instructor" and sub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem bài nộp này.")
        
    user = db.query(User).filter(User.id == sub.user_id).first()
    problem = db.query(Problem).filter(Problem.id == sub.problem_id).first()
    
    attempts = db.query(Submission).filter(
        Submission.user_id == sub.user_id,
        Submission.problem_id == sub.problem_id
    ).count()
    
    max_score = 100
    if sub.source in ["Assignments", "Contests"] and sub.context:
        from app.models import Assignment, AssignmentProblem
        assignment = db.query(Assignment).filter(Assignment.id == sub.context).first()
        if assignment:
            ap = db.query(AssignmentProblem).filter(
                AssignmentProblem.assignment_id == assignment.id,
                AssignmentProblem.problem_id == sub.problem_id
            ).first()
            if ap:
                max_score = ap.points
    
    from app.models import TestCase
    ref_tc = db.query(TestCase).filter(TestCase.problem_id == sub.problem_id).first()
    ref_sol = ref_tc.expected_query if ref_tc else ""
    
    return TeacherSubmissionResponse(
        id=sub.id,
        student=user.name if user else "Unknown",
        problem=problem.title if problem else "Unknown",
        autoScore=sub.score,
        maxScore=max_score,
        finalScore=sub.evaluated_score,
        status="Needs review" if sub.evaluated_score is None else "Accepted",
        attempts=str(attempts),
        query=sub.query_text or "",
        referenceSolution=ref_sol,
        submittedAt=sub.submitted_at.strftime("%b %d, %H:%M"),
        feedback=sub.feedback
    )

@router.put("/{submission_id}/review", response_model=TeacherSubmissionResponse)
def review_submission(submission_id: str, review: ReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "instructor":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Chỉ Giảng viên mới có quyền chấm bài.")
        
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    from fastapi import HTTPException
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    sub.evaluated_score = review.finalScore
    sub.feedback = review.feedback
    
    # Giáo viên có quyền quyết định điểm số cuối cùng, có thể hạ điểm nếu phát hiện gian lận
    sub.score = review.finalScore
    
    # Cập nhật trạng thái dựa vào điểm số (0 điểm thì đánh rớt, lớn hơn 0 điểm thì chấp nhận)
    if review.finalScore == 0:
        sub.result = "Rejected"
    else:
        sub.result = "Accepted"
    
    db.commit()
    db.refresh(sub)
    return get_submission(submission_id, db, current_user)
