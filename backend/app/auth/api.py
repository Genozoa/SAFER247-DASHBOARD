import os
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.registration_code import verify_registration_code
from app.auth.security import hash_session_token, password_policy_errors
from app.auth.service import authenticate_operator, register_operator
from app.db.models import AuthSession, Operator
from app.db.session import get_db_session

router = APIRouter(prefix="/api/auth", tags=["authentication"])
DBSession = Annotated[Session, Depends(get_db_session)]
SESSION_COOKIE = "safer247_session"
SESSION_DURATION_SECONDS = 12 * 60 * 60


class Credentials(BaseModel):
    call_sign: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("call_sign")
    @classmethod
    def normalize_call_sign(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Call sign is required.")
        return normalized


class RegistrationCredentials(Credentials):
    registration_code: str = Field(min_length=1, max_length=256)


class LoginCredentials(Credentials):
    # Existing, never-verified accounts supply a code only during first sign-in.
    registration_code: str | None = Field(default=None, max_length=256)


class CallSignChange(BaseModel):
    call_sign: str = Field(min_length=1, max_length=64)

    @field_validator("call_sign")
    @classmethod
    def normalize_call_sign(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Call sign is required.")
        return normalized


class OperatorView(BaseModel):
    id: str
    call_sign: str


class Principal:
    def __init__(self, operator: Operator, auth_session: AuthSession):
        self.operator = operator
        self.auth_session = auth_session


def operator_view(operator: Operator) -> OperatorView:
    return OperatorView(id=str(operator.id), call_sign=operator.username)


def set_session_cookie(response: Response, token: str) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/api/auth")
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DURATION_SECONDS,
        httponly=True,
        secure=os.environ.get("APP_ENV", "development").lower() == "production",
        samesite="lax",
        path="/api",
    )


def current_principal(request: Request, db: DBSession) -> Principal:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == hash_session_token(token),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if (auth_session is None or not auth_session.operator.is_active
            or auth_session.operator.registration_verified_at is None):
        raise HTTPException(status_code=401, detail="Authentication required.")
    return Principal(auth_session.operator, auth_session)


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]


def transmitting_principal(principal: CurrentPrincipal) -> Principal:
    if principal.operator.username.casefold() == "demo":
        raise HTTPException(status_code=403, detail="Demo accounts cannot transmit.")
    return principal


CurrentSender = Annotated[Principal, Depends(transmitting_principal)]


def radio_viewing_principal(principal: CurrentPrincipal) -> Principal:
    if principal.operator.username.casefold() == "demo":
        raise HTTPException(status_code=403, detail="Demo accounts cannot access live radio data.")
    return principal


CurrentRadioViewer = Annotated[Principal, Depends(radio_viewing_principal)]


def _check_password(password: str) -> None:
    errors = password_policy_errors(password)
    if errors:
        raise HTTPException(
            status_code=422,
            detail="Password must contain " + ", ".join(errors) + ".",
        )


def _integrity_error_response(db: Session, call_sign: str) -> HTTPException:
    db.rollback()
    if db.scalar(select(Operator.id).where(Operator.username == call_sign)):
        return HTTPException(status_code=409, detail="Call sign is already taken.")
    return HTTPException(status_code=409, detail="Account could not be created.")


@router.post("/register", response_model=OperatorView, status_code=201)
def register(
    payload: RegistrationCredentials,
    request: Request,
    db: DBSession,
) -> OperatorView:
    verify_registration_code(payload.registration_code, request)
    if payload.call_sign.casefold() == "demo":
        raise HTTPException(status_code=409, detail="The Demo call sign is reserved.")
    _check_password(payload.password)
    if db.scalar(select(Operator.id).where(Operator.username == payload.call_sign)):
        raise HTTPException(status_code=409, detail="Call sign is already taken.")
    try:
        operator = register_operator(db, payload.call_sign, payload.password)
        db.commit()
    except IntegrityError as error:
        raise _integrity_error_response(db, payload.call_sign) from error
    return operator_view(operator)


@router.post("/login", response_model=OperatorView)
def login(
    payload: LoginCredentials, request: Request, response: Response, db: DBSession,
) -> OperatorView:
    try:
        verifier = (lambda: verify_registration_code(payload.registration_code, request)) if payload.registration_code is not None else None
        result = authenticate_operator(
            db, payload.call_sign, payload.password,
            verify_existing_registration=verifier if payload.registration_code is not None else None,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    if result is None:
        db.rollback()
        raise HTTPException(status_code=401, detail="Invalid call sign or password.")
    operator, token = result
    db.commit()
    set_session_cookie(response, token)
    return operator_view(operator)


@router.post("/logout", status_code=204)
def logout(response: Response, principal: CurrentPrincipal, db: DBSession) -> Response:
    db.delete(principal.auth_session)
    db.commit()
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=os.environ.get("APP_ENV", "development").lower() == "production",
        samesite="lax",
        path="/api",
    )
    response.delete_cookie(key=SESSION_COOKIE, path="/api/auth")
    response.status_code = 204
    return response


@router.get("/me", response_model=OperatorView)
def me(principal: CurrentPrincipal) -> OperatorView:
    return operator_view(principal.operator)


@router.patch("/me/call-sign", response_model=OperatorView)
def update_call_sign(
    payload: CallSignChange, principal: CurrentPrincipal, db: DBSession,
) -> OperatorView:
    operator = principal.operator
    if operator.username.casefold() == "demo" or payload.call_sign.casefold() == "demo":
        raise HTTPException(status_code=403, detail="The Demo call sign is reserved.")
    other_operator = db.scalar(
        select(Operator.id).where(
            Operator.username == payload.call_sign, Operator.id != operator.id,
        )
    )
    if other_operator:
        raise HTTPException(status_code=409, detail="Call sign is already taken.")
    operator.username = payload.call_sign
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Call sign is already taken.") from error
    return operator_view(operator)
