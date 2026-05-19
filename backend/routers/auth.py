"""
Auth router — JWT-based authentication.
POST /auth/register  — create account
POST /auth/login     — returns access_token
GET  /auth/me        — returns current user (requires Bearer token)
"""
import os, hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

from models.db import get_session
from models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY           = os.getenv("JWT_SECRET", "aria-super-secret-change-in-production-please")
ALGORITHM            = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# ── bcrypt without passlib (avoids the __about__ version error) ───────────────
# We SHA-256 the password first so it's always ≤ 32 bytes → no 72-byte truncation
import bcrypt as _bcrypt

def _prepare(pw: str) -> bytes:
    """SHA-256 hash → hex string → encode to bytes (always 64 bytes, safe for bcrypt)."""
    return hashlib.sha256(pw.encode()).hexdigest().encode()

def hash_password(pw: str) -> str:
    return _bcrypt.hashpw(_prepare(pw), _bcrypt.gensalt(rounds=12)).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(_prepare(plain), hashed.encode())
    except Exception:
        return False

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Schemas ────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    created_at: datetime


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Current user dependency ─────────────────────────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_session),
) -> User:
    payload = decode_token(token)
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/register", response_model=LoginResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_session)):
    existing = db.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # First user becomes admin
    count = len(db.exec(select(User)).all())
    role = "admin" if count == 0 else "operator"

    user = User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        hashed_password=hash_password(req.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token({"sub": str(user.id), "role": user.role})
    return LoginResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == form.username)).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_token({"sub": str(user.id), "role": user.role})
    return LoginResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users")
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    users = db.exec(select(User)).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role, "created_at": u.created_at} for u in users]


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}