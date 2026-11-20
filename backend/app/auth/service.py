from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuthSession, Operator, OperatorAuth
from app.auth.security import (
    create_session_token,
    hash_password,
    hash_session_token,
    password_fingerprint,
    verify_password,
)

SESSION_DURATION = timedelta(hours=12)


def register_operator(
    db: Session,
    username: str,
    password: str,
) -> tuple[Operator, str]:
    fingerprint = password_fingerprint(password)
    if db.scalar(
        select(OperatorAuth.operator_id).where(
            OperatorAuth.password_fingerprint == fingerprint
        )
    ):
        raise ValueError("This password is taken.")

    operator = Operator(
        username=username,
        password_hash=hash_password(password),
        is_approved=True,
        role="operator",
        approved_at=datetime.now(timezone.utc),
    )
    db.add(operator)
    db.flush()
    db.add(
        OperatorAuth(
            operator_id=operator.id,
            password_fingerprint=fingerprint,
        )
    )
    token = create_session_token()
    add_auth_session(db, operator.id, token)
    return operator, token


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
    db: Session, username: str, password: str
) -> tuple[Operator, str] | None:
    operator = db.scalar(
        select(Operator)
        .join(OperatorAuth)
        .where(Operator.username == username, Operator.is_active.is_(True))
    )
    password_hash = operator.password_hash if operator else None
    if not verify_password(password, password_hash) or operator is None:
        return None
    if not operator.is_approved:
        raise PermissionError("This account is awaiting administrator approval.")

    token = create_session_token()
    add_auth_session(db, operator.id, token)
    return operator, token
