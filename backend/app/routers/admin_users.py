from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import SessionLocal
from app import models, schemas
from app.routers.auth import get_current_user
from app.security import get_password_hash

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_admin_role(current_user: models.User = Depends(get_current_user)):
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action."
        )
    return current_user

@router.get("", response_model=List[schemas.AdminUserResponse])
def get_admin_users(db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    users = db.query(models.User).all()
    results = []
    for u in users:
        joined = u.created_at.strftime("%b %d, %Y") if getattr(u, 'created_at', None) else "Unknown"
        last_active = u.last_active.strftime("%b %d, %Y") if getattr(u, 'last_active', None) else "Unknown"
        
        # Convert DB roles to Frontend expected Roles (Student, Lecturer, Admin)
        role_display = "Student"
        if u.role.lower() == "instructor":
            role_display = "Lecturer"
        elif u.role.lower() == "admin":
            role_display = "Admin"
            
        results.append(schemas.AdminUserResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=role_display,
            status=getattr(u, 'status', 'Active'),
            last_active=last_active,
            joined=joined,
            detail=getattr(u, 'department', '') or ""
        ))
    return results

@router.put("/{email}", response_model=schemas.AdminUserResponse)
def update_admin_user(
    email: str, 
    user_update: schemas.AdminUserUpdate,
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(check_admin_role)
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.name = user_update.name
    user.email = user_update.email
    user.status = user_update.status
    
    # Map frontend role to DB role
    db_role = "student"
    if user_update.role.lower() == "lecturer":
        db_role = "instructor"
    elif user_update.role.lower() == "admin":
        db_role = "admin"
    user.role = db_role
    
    db.commit()
    db.refresh(user)
    
    joined = user.created_at.strftime("%b %d, %Y") if getattr(user, 'created_at', None) else "Unknown"
    last_active = user.last_active.strftime("%b %d, %Y") if getattr(user, 'last_active', None) else "Unknown"
    
    return schemas.AdminUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user_update.role,
        status=getattr(user, 'status', 'Active'),
        last_active=last_active,
        joined=joined,
        detail=getattr(user, 'department', '') or ""
    )

@router.post("", response_model=schemas.AdminUserResponse)
def create_admin_user(
    user_create: schemas.AdminUserCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(check_admin_role)
):
    existing_user = db.query(models.User).filter(models.User.email == user_create.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    db_role = "student"
    if user_create.role.lower() == "lecturer":
        db_role = "instructor"
    elif user_create.role.lower() == "admin":
        db_role = "admin"
        
    new_user = models.User(
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
        name=user_create.name,
        initials="".join([n[0] for n in user_create.name.split() if n])[:2].upper(),
        role=db_role,
        status="Active",
        created_at=datetime.utcnow(),
        last_active=datetime.utcnow(),
        department=""
    )
    db.add(new_user)
    
    # Log activity
    log = models.ActivityLog(
        user_id=admin_user.id,
        action=f"Created {user_create.role} account for {new_user.email}"
    )
    db.add(log)
    db.commit()
    db.refresh(new_user)
    
    joined = new_user.created_at.strftime("%b %d, %Y")
    last_active = new_user.last_active.strftime("%b %d, %Y")
    
    return schemas.AdminUserResponse(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        role=user_create.role,
        status=new_user.status,
        last_active=last_active,
        joined=joined,
        detail=new_user.department or ""
    )

@router.get("/lecturer-requests", response_model=List[schemas.LecturerRequestResponse])
def get_lecturer_requests(db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    users = db.query(models.User).filter(
        models.User.role == "instructor",
        models.User.status == "Pending"
    ).all()
    results = []
    for u in users:
        submitted = u.created_at.strftime("%b %d, %Y") if getattr(u, 'created_at', None) else "Unknown"
        results.append(schemas.LecturerRequestResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            department=getattr(u, 'department', '') or "",
            submitted=submitted
        ))
    return results

@router.post("/lecturer-requests/{user_id}/approve")
def approve_lecturer_request(user_id: str, db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.status == "Pending").first()
    if not user:
        raise HTTPException(status_code=404, detail="Request not found")
    user.status = "Active"
    
    # Log activity
    log = models.ActivityLog(
        user_id=admin_user.id,
        action=f"Approved lecturer request for {user.email}"
    )
    db.add(log)
    db.commit()
    return {"message": "Approved"}

@router.post("/lecturer-requests/{user_id}/reject")
def reject_lecturer_request(user_id: str, db: Session = Depends(get_db), admin_user: models.User = Depends(check_admin_role)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.status == "Pending").first()
    if not user:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Log activity
    log = models.ActivityLog(
        user_id=admin_user.id,
        action=f"Rejected lecturer request for {user.email}"
    )
    db.add(log)
    
    db.delete(user)
    db.commit()
    return {"message": "Rejected"}
