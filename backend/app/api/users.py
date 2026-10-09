from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.entities import User, UserRole
from app.schemas.all_schemas import UserCreate, UserOut
from app.api.deps import require_staff_or_admin, require_admin

router = APIRouter(prefix="/users", tags=["Team & Access"])

class UserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

@router.get("", response_model=List[UserOut])
def list_team(db: Session = Depends(get_db), staff: User = Depends(require_staff_or_admin)):
    """Staff and admins, e.g. for the lead-owner picker."""
    return db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.STAFF])).order_by(User.full_name).all()

@router.post("", response_model=UserOut, status_code=201)
def create_team_member(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    user = User(email=email, full_name=payload.full_name.strip(), role=payload.role,
                hashed_password=get_password_hash(payload.password), is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}", response_model=UserOut)
def update_team_member(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role or access.")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user
