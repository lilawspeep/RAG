from sqlalchemy.orm import Session

from .config import settings
from .models import Role, User
from .security import hash_password


def seed(db: Session) -> None:
    roles = {r.name: r for r in db.query(Role).all()}
    for name in ("student", "admin"):
        if name not in roles:
            role = Role(name=name)
            db.add(role)
            db.flush()
            roles[name] = role
    if settings.admin_password and settings.admin_username:
        exists = db.query(User).filter(User.username == settings.admin_username).first()
        if exists is None:
            db.add(
                User(
                    full_name=settings.admin_name,
                    email=settings.admin_email.strip().lower() or None,
                    username=settings.admin_username,
                    hashed_password=hash_password(settings.admin_password),
                    role_id=roles["admin"].id,
                )
            )
    db.commit()
