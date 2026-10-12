from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Writathon, WritathonStatus
from app.schemas.all_schemas import WritathonCreate, WritathonUpdate, WritathonOut
from app.api.deps import require_admin, require_staff_or_admin
from app.core.audit import audit, diff

router = APIRouter(prefix="/writathons", tags=["Writathons"])

@router.get("", response_model=List[WritathonOut])
def list_writathons(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Writathon)
    if active_only:
        query = query.filter(Writathon.status == WritathonStatus.ACTIVE)
    return query.order_by(Writathon.created_at.desc()).all()

@router.get("/{writathon_id}", response_model=WritathonOut)
def get_writathon(writathon_id: int, db: Session = Depends(get_db)):
    writathon = db.query(Writathon).filter(Writathon.id == writathon_id).first()
    if not writathon:
        raise HTTPException(status_code=404, detail="Writathon not found.")
    return writathon

@router.post("", response_model=WritathonOut, status_code=status.HTTP_201_CREATED)
def create_writathon(
    payload: WritathonCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    existing = db.query(Writathon).filter(Writathon.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Writathon with this code already exists.")
    writathon = Writathon(**payload.model_dump())
    db.add(writathon)
    db.flush()
    audit(db, admin, "writathon.create", "writathon", writathon.id, payload.model_dump())
    db.commit()
    db.refresh(writathon)
    return writathon

@router.put("/{writathon_id}", response_model=WritathonOut)
def update_writathon(
    writathon_id: int,
    payload: WritathonUpdate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    writathon = db.query(Writathon).filter(Writathon.id == writathon_id).first()
    if not writathon:
        raise HTTPException(status_code=404, detail="Writathon not found.")

    update_data = payload.model_dump(exclude_unset=True)
    start = update_data.get("start_date", writathon.start_date)
    deadline = update_data.get("submission_deadline", writathon.submission_deadline)
    end = update_data.get("end_date", writathon.end_date)
    naive = lambda d: d.replace(tzinfo=None) if d and d.tzinfo else d
    if not (naive(start) <= naive(deadline) <= naive(end)):
        raise HTTPException(status_code=400, detail="Dates must satisfy start_date <= submission_deadline <= end_date.")
    audit(db, admin, "writathon.update", "writathon", writathon.id, diff(writathon, update_data))
    for field, value in update_data.items():
        setattr(writathon, field, value)

    db.commit()
    db.refresh(writathon)
    return writathon
