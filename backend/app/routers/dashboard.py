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
            date_str = sub_time.strftime("%Y-%m-%d")
            daily_counts[date_str] += 1
            distinct_dates.add(date_str)
            
    submissions_per_day = [{"date": k, "count": v} for k, v in daily_counts.items()]
    
    # Tính streak
    current_streak = 0
    sorted_dates = sorted(list(distinct_dates), reverse=True)
    
    today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    yesterday_str = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    
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
