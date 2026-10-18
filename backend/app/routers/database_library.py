from typing import List
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DatabaseLibraryEntry, User
from app.routers.auth import get_current_user
from app.schemas import DatabaseLibraryEntryCreate, DatabaseLibraryEntryResponse

router = APIRouter()


def require_instructor(current_user: User) -> None:
    if current_user.role.lower() not in {"instructor", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Instructor access required.")


def dataset_payload(entry_data: DatabaseLibraryEntryCreate) -> list[dict[str, str]]:
    return [dataset.model_dump(by_alias=True) for dataset in entry_data.datasets or []]


@router.get("", response_model=List[DatabaseLibraryEntryResponse])
def get_database_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_instructor(current_user)
    return (
        db.query(DatabaseLibraryEntry)
        .filter(DatabaseLibraryEntry.instructor_id == current_user.id)
        .order_by(DatabaseLibraryEntry.updated_at.desc(), DatabaseLibraryEntry.title.asc())
        .all()
    )


@router.post("", response_model=DatabaseLibraryEntryResponse, status_code=status.HTTP_201_CREATED)
def create_database_library_entry(
    entry_data: DatabaseLibraryEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_instructor(current_user)
    entry = DatabaseLibraryEntry(
        id=str(uuid.uuid4()),
        instructor_id=current_user.id,
        title=entry_data.title,
        database_file_name=entry_data.database_file_name,
        create_table_file_name=entry_data.create_table_file_name,
        insert_into_file_name=entry_data.datasets[0].file_name,
        create_table_sql=entry_data.create_table_sql,
        insert_into_sql=entry_data.datasets[0].sql,
        datasets_json=json.dumps(dataset_payload(entry_data), ensure_ascii=False),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=DatabaseLibraryEntryResponse)
def update_database_library_entry(
    entry_id: str,
    entry_data: DatabaseLibraryEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_instructor(current_user)
    entry = db.query(DatabaseLibraryEntry).filter(
        DatabaseLibraryEntry.id == entry_id,
        DatabaseLibraryEntry.instructor_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database library entry not found.")

    entry.title = entry_data.title
    entry.database_file_name = entry_data.database_file_name
    entry.create_table_file_name = entry_data.create_table_file_name
    entry.insert_into_file_name = entry_data.datasets[0].file_name
    entry.create_table_sql = entry_data.create_table_sql
    entry.insert_into_sql = entry_data.datasets[0].sql
    entry.datasets_json = json.dumps(dataset_payload(entry_data), ensure_ascii=False)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_database_library_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_instructor(current_user)
    entry = db.query(DatabaseLibraryEntry).filter(
        DatabaseLibraryEntry.id == entry_id,
        DatabaseLibraryEntry.instructor_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database library entry not found.")

    db.delete(entry)
    db.commit()
    return {"ok": True}
