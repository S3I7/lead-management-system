from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, func, or_

from app.core.database import get_db
from app.models.entities import Student, Lead
from app.schemas.all_schemas import StudentOut, StudentHistoryOut
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("", response_model=List[StudentOut])
def list_students(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    reg_count = func.count(Lead.id).label("registration_count")
    query = db.query(Student, reg_count).outerjoin(Lead, Lead.student_id == Student.id).group_by(Student.id)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Student.child_name.ilike(like), Student.parent_name.ilike(like),
                                 Student.parent_email.ilike(like), Student.school.ilike(like)))
    rows = query.order_by(desc(Student.created_at)).offset(skip).limit(limit).all()
    return [{**StudentOut.model_validate(st).model_dump(), "registration_count": n} for st, n in rows]

@router.get("/{student_id}", response_model=StudentHistoryOut)
def get_student_history(student_id: int, db: Session = Depends(get_db), staff = Depends(require_staff_or_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    registrations = db.query(Lead).options(
        selectinload(Lead.submissions), selectinload(Lead.owner), selectinload(Lead.writathon)
    ).filter(Lead.student_id == student.id).order_by(desc(Lead.created_at)).all()
    return {
        "student": {**StudentOut.model_validate(student).model_dump(), "registration_count": len(registrations)},
        "registrations": registrations,
    }
