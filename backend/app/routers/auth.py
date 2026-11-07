import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Role, User
from ..schemas import LoginIn, ProfileUpdate, RegisterIn, TokenOut, UserOut
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        username=user.username,
        university_id=user.university_id,
        role=user.role.name,
        faculty=user.faculty,
        major=user.major,
        created_at=user.created_at,
    )


def _student_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == "student").one()
    return role


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid_email")
    if not re.search(r"[A-Za-z\u0600-\u06FF]", body.password) or not re.search(r"\d", body.password):
        raise HTTPException(422, "weak_password")
    uni = (body.university_id or "").strip() or None
    if uni and not re.fullmatch(r"\d{4,12}", uni):
        raise HTTPException(422, "invalid_university_id")
    username = (body.username or "").strip() or None
    conds = [func.lower(User.email) == email]
    if uni:
        conds.append(User.university_id == uni)
    if username:
        conds.append(User.username == username)
    taken = db.query(User).filter(or_(*conds)).first()
    if taken:
        raise HTTPException(409, "user_already_exists")
    user = User(
        full_name=body.full_name.strip(),
        email=email,
        username=username,
        university_id=uni,
        hashed_password=hash_password(body.password),
        role_id=_student_role(db).id,
        faculty=(body.faculty or "").strip() or None,
        major=(body.major or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id, "student"), user=to_out(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip()
    user = (
        db.query(User)
        .filter(or_(func.lower(User.email) == ident.lower(), User.username == ident, User.university_id == ident))
        .first()
    )
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "invalid_credentials")
    return TokenOut(access_token=create_token(user.id, user.role.name), user=to_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return to_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    uni = (body.university_id or "").strip() or None
    if uni and not re.fullmatch(r"\d{4,12}", uni):
        raise HTTPException(422, "invalid_university_id")
    if uni and db.query(User).filter(User.university_id == uni, User.id != user.id).first():
        raise HTTPException(409, "user_already_exists")
    user.full_name = body.full_name.strip()
    user.university_id = uni
    db.commit()
    db.refresh(user)
    return to_out(user)
