from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Problem, Submission
from app.schemas import DashboardStats, ProblemListResponse
from app.routers.auth import get_current_user
import datetime
from collections import defaultdict

router = APIRouter()

@router.get("", response_model=DashboardStats)
def get_dashboard(tz_offset: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Lấy các problem đã giải quyết
    accepted_subs = db.query(Submission.problem_id).filter(
        Submission.user_id == current_user.id,
        Submission.result == "Accepted"
    ).distinct().all()
    accepted_problem_ids = {sub[0] for sub in accepted_subs}

    attempted_subs = db.query(Submission.problem_id).filter(
        Submission.user_id == current_user.id
    ).distinct().all()
    attempted_problem_ids = {sub[0] for sub in attempted_subs}

    solved = 0
    easy = 0
    medium = 0
    hard = 0
    continuing_problems = []
    
    if accepted_problem_ids:
        accepted_problems = db.query(Problem.difficulty).filter(Problem.id.in_(accepted_problem_ids)).all()
        solved = len(accepted_problems)
        easy = sum(1 for p in accepted_problems if p.difficulty == "Easy")
        medium = sum(1 for p in accepted_problems if p.difficulty == "Medium")
        hard = sum(1 for p in accepted_problems if p.difficulty == "Hard")

    continuing_ids = attempted_problem_ids - accepted_problem_ids
    if continuing_ids:
        c_problems = db.query(Problem).filter(Problem.id.in_(continuing_ids)).all()
        for p in c_problems:
            p_resp = ProblemListResponse.model_validate(p)
            p_resp.progress = "In progress"
            continuing_problems.append(p_resp)

    # Lấy dữ liệu submission 1 năm gần nhất
    one_year_ago = datetime.datetime.utcnow() - datetime.timedelta(days=365)
    recent_subs = db.query(Submission.submitted_at).filter(
        Submission.user_id == current_user.id,
        Submission.submitted_at >= one_year_ago
    ).all()
    
    daily_counts = defaultdict(int)
    distinct_dates = set()
    
    for (sub_time,) in recent_subs:
        if sub_time:
            local_time = sub_time - datetime.timedelta(minutes=tz_offset)
            date_str = local_time.strftime("%Y-%m-%d")
            daily_counts[date_str] += 1
            distinct_dates.add(date_str)
            
    submissions_per_day = [{"date": k, "count": v} for k, v in daily_counts.items()]
    
    # Tính streak
    current_streak = 0
    sorted_dates = sorted(list(distinct_dates), reverse=True)
    
    now_local = datetime.datetime.utcnow() - datetime.timedelta(minutes=tz_offset)
    today_str = now_local.strftime("%Y-%m-%d")
    yesterday_str = (now_local - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    
    if sorted_dates:
        if sorted_dates[0] in (today_str, yesterday_str):
            current_streak = 1
            current_date = datetime.datetime.strptime(sorted_dates[0], "%Y-%m-%d")
            
            for i in range(1, len(sorted_dates)):
                prev_date = datetime.datetime.strptime(sorted_dates[i], "%Y-%m-%d")
                expected_prev = current_date - datetime.timedelta(days=1)
                
                if prev_date.date() == expected_prev.date():
                    current_streak += 1
                    current_date = prev_date
                else:
                    break

    return DashboardStats(
        solved=solved,
        easy=easy,
        medium=medium,
        hard=hard,
        continuing=continuing_problems,
        deadlines=[],
        current_streak=current_streak,
        submissions_per_day=submissions_per_day
    )
