from datetime import datetime, timedelta, timezone
from typing import Callable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuthSession, Operator
from app.auth.security import (
    create_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)

SESSION_DURATION = timedelta(hours=12)


def register_operator(
    db: Session,
    username: str,
    password: str,
) -> Operator:
    operator = Operator(
        username=username,
        password_hash=hash_password(password),
        registration_verified_at=datetime.now(timezone.utc),
    )
    db.add(operator)
    db.flush()
    return operator


def add_auth_session(db: Session, operator_id: UUID, token: str) -> AuthSession:
    auth_session = AuthSession(
        operator_id=operator_id,
        token_hash=hash_session_token(token),
        expires_at=datetime.now(timezone.utc) + SESSION_DURATION,
    )
    db.add(auth_session)
    db.flush()
    return auth_session


def authenticate_operator(
    db: Session, username: str, password: str,
    verify_existing_registration: Callable[[], None] | None = None,
) -> tuple[Operator, str] | None:
    operator = db.scalar(
        select(Operator)
        .where(Operator.username == username, Operator.is_active.is_(True))
    )
    password_hash = operator.password_hash if operator else None
    if not verify_password(password, password_hash) or operator is None:
        return None
    if operator.registration_verified_at is None:
        if verify_existing_registration is None:
            raise PermissionError("Existing account requires registration-code verification.")
        verify_existing_registration()
        operator.registration_verified_at = datetime.now(timezone.utc)

    token = create_session_token()
    add_auth_session(db, operator.id, token)
    return operator, token
