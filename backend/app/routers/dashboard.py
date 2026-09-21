from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import DashboardStats, ProblemListResponse
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Lấy các problem đã giải quyết
    accepted_subs = db.query(Submission.problem_id).filter(
        Submission.user_id == current_user.id,
        Submission.result == "Accepted"
    ).distinct().all()
    accepted_problem_ids = {sub[0] for sub in accepted_subs}

    problems = db.query(Problem).all()

    solved = 0
    easy = 0
    medium = 0
    hard = 0
    continuing_problems = []

    for p in problems:
        if p.id in accepted_problem_ids:
            solved += 1
            if p.difficulty == "Easy":
                easy += 1
            elif p.difficulty == "Medium":
                medium += 1
            elif p.difficulty == "Hard":
                hard += 1
        else:
            # Kiểm tra xem có submission nào chưa (đang giải dang dở)
            has_sub = db.query(Submission.id).filter(
                Submission.user_id == current_user.id,
                Submission.problem_id == p.id
            ).first()
            if has_sub:
                p_resp = ProblemListResponse.model_validate(p)
                p_resp.progress = "In progress"
                continuing_problems.append(p_resp)

    return DashboardStats(
        solved=solved,
        easy=easy,
        medium=medium,
        hard=hard,
        continuing=continuing_problems,
        deadlines=[]
    )
