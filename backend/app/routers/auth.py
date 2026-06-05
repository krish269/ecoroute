from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app import models
from app.auth import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token_str,
    get_current_user,
)
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8 or len(v) > 128:
            raise ValueError("Password must be between 8 and 128 characters")
        return v

    @field_validator("display_name")
    @classmethod
    def display_name_length(cls, v: str) -> str:
        if len(v.strip()) < 1 or len(v) > 64:
            raise ValueError("Display name must be between 1 and 64 characters")
        return v.strip()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email address is already in use")

    user = models.User(
        email=req.email,
        display_name=req.display_name,
        hashed_password=hash_password(req.password),
        role=models.UserRole.resident,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "display_name": user.display_name}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": user.id, "role": user.role.value})
    refresh_token_str = create_refresh_token_str()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    rt = models.RefreshToken(user_id=user.id, token=refresh_token_str, expires_at=expires)
    db.add(rt)
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token_str)


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == req.refresh_token,
        models.RefreshToken.revoked == False,
    ).first()
    if not rt or rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    access_token = create_access_token({"sub": rt.user_id, "role": rt.user.role.value})
    new_refresh_str = create_refresh_token_str()
    new_expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    rt.revoked = True
    new_rt = models.RefreshToken(user_id=rt.user_id, token=new_refresh_str, expires_at=new_expires)
    db.add(new_rt)
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_str)


@router.post("/logout")
def logout(req: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == req.refresh_token
    ).first()
    if rt:
        rt.revoked = True
        db.commit()
    return {"detail": "Logged out"}
