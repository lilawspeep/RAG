from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import get_db
import jwt

from ..deps import bearer
from ..models import ContactMessage, User
from ..schemas import ContactIn
from ..security import decode_token

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", status_code=201)
def submit(
    body: ContactIn,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    user_id = None
    if creds is not None:
        try:
            payload = decode_token(creds.credentials)
            if db.get(User, payload.get("sub")):
                user_id = payload.get("sub")
        except jwt.PyJWTError:
            user_id = None
    db.add(
        ContactMessage(
            user_id=user_id,
            name=body.name.strip(),
            email=body.email.strip(),
            subject=body.subject.strip(),
            message=body.message.strip(),
        )
    )
    db.commit()
    return {"ok": True}
