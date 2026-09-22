from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Favorite, ProblemList, ProblemListItem, Problem
from app.schemas import PreferencesResponse, ListCreateRequest, CustomListSchema
from app.routers.auth import get_current_user
import uuid

router = APIRouter()

@router.get("", response_model=PreferencesResponse)
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    favs = db.query(Favorite.problem_id).filter(Favorite.user_id == current_user.id).all()
    favorite_ids = [f[0] for f in favs]
    
    lists = db.query(ProblemList).filter(ProblemList.user_id == current_user.id).order_by(ProblemList.created_at).all()
    
    custom_lists = []
    for l in lists:
        items = db.query(ProblemListItem.problem_id).filter(ProblemListItem.list_id == l.id).all()
        custom_lists.append(CustomListSchema(
            id=l.id,
            name=l.name,
            problem_ids=[i[0] for i in items]
        ))
        
    return PreferencesResponse(
        favorites=favorite_ids,
        custom_lists=custom_lists
    )

@router.post("/favorites/{problem_id}")
def toggle_favorite(problem_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    fav = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.problem_id == problem_id).first()
    
    if fav:
        db.delete(fav)
        db.commit()
        return {"status": "removed"}
    else:
        new_fav = Favorite(user_id=current_user.id, problem_id=problem_id)
        db.add(new_fav)
        db.commit()
        return {"status": "added"}

@router.post("/lists", response_model=CustomListSchema)
def create_list(request: ListCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_list = ProblemList(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=request.name
    )
    db.add(new_list)
    db.flush()
    
    for pid in request.problem_ids:
        # Verify problem exists (optional but good practice)
        item = ProblemListItem(list_id=new_list.id, problem_id=pid)
        db.add(item)
        
    db.commit()
    db.refresh(new_list)
    
    return CustomListSchema(
        id=new_list.id,
        name=new_list.name,
        problem_ids=request.problem_ids
    )
