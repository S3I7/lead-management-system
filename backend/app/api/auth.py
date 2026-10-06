from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.entities import User, UserRole
from app.schemas.all_schemas import UserLogin, Token, UserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive."
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/quick-switch/{role_name}", response_model=Token)
def quick_switch_role(role_name: str, db: Session = Depends(get_db)):
    """Convenient switch endpoint for demo/testing across Admin, Staff, Parent."""
    target_role = role_name.upper()
    if target_role == "ADMIN":
        user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    elif target_role in ["STAFF", "REVIEWER"]:
        user = db.query(User).filter(User.role == UserRole.STAFF).first()
    else:
        user = db.query(User).filter(User.role == UserRole.PARENT).first()

    if not user:
        raise HTTPException(status_code=404, detail=f"No demo user with role {target_role} found.")

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }
