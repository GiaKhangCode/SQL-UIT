from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid

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

def check_instructor_role(current_user: models.User = Depends(get_current_user)):
    if current_user.role.lower() not in ["instructor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage classes."
        )
    return current_user

@router.get("/students", response_model=List[schemas.ClassMemberResponse])
def get_all_students(db: Session = Depends(get_db), current_user: models.User = Depends(check_instructor_role)):
    students = db.query(models.User).filter(models.User.role == "student").all()
    results = []
    for s in students:
        results.append(schemas.ClassMemberResponse(
            id=s.id,
            name=s.name,
            email=s.email,
            role=s.role,
            joined_at=s.created_at # Dummy joined_at for the list
        ))
    return results

@router.get("", response_model=List[schemas.ClassResponse])
def get_classes(db: Session = Depends(get_db), current_user: models.User = Depends(check_instructor_role)):
    if current_user.role.lower() == "admin":
        classes = db.query(models.Class).all()
    else:
        classes = db.query(models.Class).filter(models.Class.instructor_id == current_user.id).all()
    results = []
    for c in classes:
        students_count = db.query(models.ClassEnrollment).filter(models.ClassEnrollment.class_id == c.id).count()
        results.append(schemas.ClassResponse(
            id=c.id,
            course=c.course,
            term=c.term,
            instructor_id=c.instructor_id,
            mode=c.mode,
            status=c.status,
            students=students_count,
            groups=[],
            start_date=c.start_date,
            end_date=c.end_date
        ))
    return results

@router.post("", response_model=schemas.ClassResponse)
def create_class(
    class_data: schemas.ClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_instructor_role)
):
    existing = db.query(models.Class).filter(models.Class.id == class_data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Class ID already exists")
        
    new_class = models.Class(
        id=class_data.id,
        course=class_data.course,
        term=class_data.term,
        instructor_id=current_user.id,
        start_date=class_data.start_date,
        end_date=class_data.end_date,
        mode=class_data.mode,
        status="Active",
        created_at=datetime.utcnow()
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    return schemas.ClassResponse(
        id=new_class.id,
        course=new_class.course,
        term=new_class.term,
        instructor_id=new_class.instructor_id,
        mode=new_class.mode,
        status=new_class.status,
        students=0,
        groups=[],
        start_date=new_class.start_date,
        end_date=new_class.end_date
    )

@router.get("/{class_id}/members", response_model=List[schemas.ClassMemberResponse])
def get_class_members(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_instructor_role)
):
    if current_user.role.lower() == "admin":
        c = db.query(models.Class).filter(models.Class.id == class_id).first()
    else:
        c = db.query(models.Class).filter(models.Class.id == class_id, models.Class.instructor_id == current_user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found or you don't have access")
        
    enrollments = db.query(models.ClassEnrollment).filter(models.ClassEnrollment.class_id == class_id).all()
    results = []
    for en in enrollments:
        student = db.query(models.User).filter(models.User.id == en.student_id).first()
        if student:
            results.append(schemas.ClassMemberResponse(
                id=student.id,
                name=student.name,
                email=student.email,
                role=en.role,
                joined_at=en.joined_at
            ))
    return results

@router.post("/{class_id}/members", response_model=schemas.ClassMemberResponse)
def add_class_member(
    class_id: str,
    member_data: schemas.ClassMemberAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_instructor_role)
):
    if current_user.role.lower() == "admin":
        c = db.query(models.Class).filter(models.Class.id == class_id).first()
    else:
        c = db.query(models.Class).filter(models.Class.id == class_id, models.Class.instructor_id == current_user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found or you don't have access")
        
    student = db.query(models.User).filter(models.User.id == member_data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    existing_enrollment = db.query(models.ClassEnrollment).filter(
        models.ClassEnrollment.class_id == class_id,
        models.ClassEnrollment.student_id == student.id
    ).first()
    
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Sinh viên này đã được thêm vào lớp từ trước.")
    
    enrollment = models.ClassEnrollment(
        class_id=class_id,
        student_id=student.id,
        role="Member",
        joined_at=datetime.utcnow()
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    
    return schemas.ClassMemberResponse(
        id=student.id,
        name=student.name,
        email=student.email,
        role=enrollment.role,
        joined_at=enrollment.joined_at
    )

@router.delete("/{class_id}/members/{student_id}")
def remove_class_member(
    class_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_instructor_role)
):
    if current_user.role.lower() == "admin":
        c = db.query(models.Class).filter(models.Class.id == class_id).first()
    else:
        c = db.query(models.Class).filter(models.Class.id == class_id, models.Class.instructor_id == current_user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found or you don't have access")
        
    enrollment = db.query(models.ClassEnrollment).filter(
        models.ClassEnrollment.class_id == class_id,
        models.ClassEnrollment.student_id == student_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student is not in this class")
        
    db.delete(enrollment)
    db.commit()
    
    return {"message": "Member removed successfully"}
