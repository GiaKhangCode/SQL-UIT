from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import SessionLocal
from app import models, schemas
from app.routers.auth import get_current_user

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
            detail="You do not have admin permissions."
        )
    return current_user

@router.get("", response_model=List[schemas.AdminClassResponse])
def get_admin_classes(db: Session = Depends(get_db), current_user: models.User = Depends(check_admin_role)):
    classes = db.query(models.Class).all()
    results = []
    for c in classes:
        lecturer_name = "Unassigned"
        if c.instructor_id:
            instructor = db.query(models.User).filter(models.User.id == c.instructor_id).first()
            if instructor:
                lecturer_name = instructor.name
                
        students_count = db.query(models.ClassEnrollment).filter(models.ClassEnrollment.class_id == c.id).count()
        
        results.append(schemas.AdminClassResponse(
            id=c.id,
            course=c.course,
            lecturer=lecturer_name,
            students=students_count,
            status=c.status,
            semester=c.term,
            dates="Sep 07 – Nov 28, 2026",
            start_date=c.start_date,
            end_date=c.end_date
        ))
    return results

@router.post("", response_model=schemas.AdminClassResponse)
def create_admin_class(
    data: schemas.AdminClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin_role)
):
    existing = db.query(models.Class).filter(models.Class.id == data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Class ID already exists")
        
    instructor_id = None
    lecturer_name = "Unassigned"
    if data.lecturer_name != "Unassigned":
        instructor = db.query(models.User).filter(models.User.name == data.lecturer_name, models.User.role == "instructor").first()
        if instructor:
            instructor_id = instructor.id
            lecturer_name = instructor.name
        
    new_class = models.Class(
        id=data.id,
        course=data.course,
        term=data.semester,
        instructor_id=instructor_id,
        start_date=data.start_date,
        end_date=data.end_date,
        status="Draft",
        created_at=datetime.utcnow()
    )
    db.add(new_class)
    
    # Log activity
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Created class {new_class.id}"
    )
    db.add(log)
    db.commit()
    db.refresh(new_class)
    
    return schemas.AdminClassResponse(
        id=new_class.id,
        course=new_class.course,
        lecturer=lecturer_name,
        students=0,
        status=new_class.status,
        semester=new_class.term,
        dates="Sep 07 – Nov 28, 2026",
        start_date=new_class.start_date,
        end_date=new_class.end_date
    )

@router.put("/{class_id}", response_model=schemas.AdminClassResponse)
def update_admin_class(
    class_id: str,
    data: schemas.AdminClassUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin_role)
):
    c = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
        
    if data.course is not None:
        c.course = data.course
    if data.semester is not None:
        c.term = data.semester
    if data.status is not None:
        c.status = data.status
    if data.start_date is not None:
        c.start_date = data.start_date
    if data.end_date is not None:
        c.end_date = data.end_date
        
    lecturer_name = "Unassigned"
    if data.lecturer_name is not None:
        if data.lecturer_name == "Unassigned":
            c.instructor_id = None
        else:
            instructor = db.query(models.User).filter(models.User.name == data.lecturer_name, models.User.role == "instructor").first()
            if instructor:
                c.instructor_id = instructor.id
                lecturer_name = instructor.name
            else:
                # If instructor not found by name, keep existing or handle error
                # For simplicity, we just ignore if not found
                pass
                
    # Log activity
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Updated class {c.id}"
    )
    db.add(log)
    db.commit()
    db.refresh(c)
    
    # Reload lecturer name if not unassigned
    if c.instructor_id:
        instructor = db.query(models.User).filter(models.User.id == c.instructor_id).first()
        if instructor:
            lecturer_name = instructor.name
            
    students_count = db.query(models.ClassEnrollment).filter(models.ClassEnrollment.class_id == c.id).count()
            
    return schemas.AdminClassResponse(
        id=c.id,
        course=c.course,
        lecturer=lecturer_name,
        students=students_count,
        status=c.status,
        semester=c.term,
        dates="Sep 07 – Nov 28, 2026",
        start_date=c.start_date,
        end_date=c.end_date
    )
