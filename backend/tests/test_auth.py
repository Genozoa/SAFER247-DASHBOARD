import sys
from datetime import datetime, timezone

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.auth import seed_demo
from app.auth.registration_code import attempt_limiter
from app.auth.security import password_policy_errors, verify_password
from app.db.models import AuthSession, Operator
from app.db.session import create_session_factory, get_db_session
from app.main import create_app


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("OPERATOR_REGISTRATION_CODE_HASH", PasswordHasher().hash("capstone"))
    attempt_limiter.reset()
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Operator.metadata.create_all(
        engine, tables=[Operator.__table__, AuthSession.__table__],
    )
    factory = create_session_factory(engine)
    app = create_app()

    def override_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_session
    with TestClient(app) as client:
        yield client, factory
    engine.dispose()
    attempt_limiter.reset()


def register(client: TestClient, call_sign="DEMO-1", password="Strong!Pass9", code="capstone"):
    return client.post("/api/auth/register", json={
        "call_sign": call_sign, "password": password, "registration_code": code,
    })


def login(client: TestClient, call_sign="DEMO-1", password="Strong!Pass9", code=None):
    payload = {"call_sign": call_sign, "password": password}
    if code is not None:
        payload["registration_code"] = code
    return client.post("/api/auth/login", json=payload)


def test_password_policy_requires_all_character_types():
    assert password_policy_errors("short") == [
        "at least 8 characters", "an uppercase letter", "a number", "a special character",
    ]
    assert password_policy_errors("Strong!Pass9") == []


def test_registration_password_validation(auth_client):
    client, _ = auth_client
    response = register(client, password="weakpass")
    assert response.status_code == 422
    assert "uppercase letter" in response.json()["detail"]


def test_register_login_logout_and_session_revocation(auth_client):
    client, factory = auth_client
    assert client.get("/api/auth/me").status_code == 401
    response = register(client)
    assert response.status_code == 201
    assert response.json()["call_sign"] == "DEMO-1"
    assert "approved" not in response.json()
    assert "role" not in response.json()
    assert "safer247_session" not in response.headers.get("set-cookie", "")
    with factory() as session:
        account = session.query(Operator).one()
        assert account.password_hash != "Strong!Pass9"
        assert verify_password("Strong!Pass9", account.password_hash)
        assert account.registration_verified_at is not None

    assert client.get("/api/auth/me").status_code == 401
    logged_in = login(client)
    assert logged_in.status_code == 200
    assert "HttpOnly" in logged_in.headers["set-cookie"]
    assert client.get("/api/auth/me").json()["call_sign"] == "DEMO-1"
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    with factory() as session:
        assert session.query(AuthSession).count() == 0
    assert login(client).status_code == 200
    assert login(client, password="wrong").status_code == 401


def test_independent_sessions_for_same_password(auth_client):
    client, factory = auth_client
    assert register(client, "OP-1").status_code == 201
    assert register(client, "OP-2").status_code == 201
    assert register(client, "OP-1", "Other!Password8").status_code == 409
    assert login(client, "OP-1").status_code == 200
    session_one = client.cookies.get("safer247_session")
    assert client.get("/api/auth/me").json()["call_sign"] == "OP-1"
    assert login(client, "OP-2").status_code == 200
    session_two = client.cookies.get("safer247_session")
    assert session_one != session_two
    assert client.get("/api/auth/me").json()["call_sign"] == "OP-2"
    with factory() as session:
        assert session.query(Operator).count() == 2


def test_authenticated_operator_can_change_call_sign(auth_client):
    client, factory = auth_client
    assert register(client).status_code == 201
    assert register(client, "OTHER-1", "Other!Password8").status_code == 201
    assert login(client).status_code == 200
    assert client.patch("/api/auth/me/call-sign", json={
        "call_sign": "OTHER-1",
    }).status_code == 409
    response = client.patch("/api/auth/me/call-sign", json={"call_sign": "NEW-CALLSIGN"})
    assert response.status_code == 200
    assert response.json()["call_sign"] == "NEW-CALLSIGN"
    assert client.get("/api/auth/me").json()["call_sign"] == "NEW-CALLSIGN"
    with factory() as session:
        assert session.query(Operator).filter_by(username="NEW-CALLSIGN").one()
    assert client.patch("/api/auth/me/call-sign", json={"call_sign": " "}).status_code == 422


def test_demo_seed_is_idempotent_and_does_not_replace_accounts(auth_client, monkeypatch):
    _, factory = auth_client
    monkeypatch.setattr(seed_demo, "get_engine", lambda: factory.kw["bind"])
    assert seed_demo.seed_demo_operator("DEMO-OP", "Demo!Pass123") is True
    assert seed_demo.seed_demo_operator("DEMO-OP", "Demo!Pass123") is False
    with pytest.raises(ValueError, match="different account"):
        seed_demo.seed_demo_operator("DEMO-OP", "Another!Pass123")
    with factory() as session:
        operator = session.query(Operator).filter_by(username="DEMO-OP").one()
        assert operator.password_hash != "Demo!Pass123"
        assert operator.registration_verified_at is not None


def test_demo_seed_requires_explicit_opt_in_and_refuses_production(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["seed_demo"])
    with pytest.raises(SystemExit):
        seed_demo.main()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(sys, "argv", ["seed_demo", "--confirm-demo-seed"])
    with pytest.raises(SystemExit):
        seed_demo.main()


def test_registration_requires_valid_code(auth_client):
    client, factory = auth_client
    invalid = register(client, "OUTSIDE", code="wrong")
    assert invalid.status_code == 403
    with factory() as session:
        assert session.query(Operator).count() == 0


def test_missing_code_configuration_disables_registration(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.delenv("OPERATOR_REGISTRATION_CODE_HASH")
    assert register(client).status_code == 503


def test_registration_code_attempt_limit(auth_client):
    client, factory = auth_client
    for attempt in range(5):
        assert register(client, f"GUESS-{attempt}", code="wrong").status_code == 403
    last = register(client, "LAST", code="capstone")
    assert last.status_code == 429
    assert "Retry-After" in last.headers
    with factory() as session:
        assert session.query(Operator).count() == 0


def test_legacy_unverified_account_requires_credential_and_code(auth_client):
    client, factory = auth_client
    assert register(client).status_code == 201
    with factory() as session:
        account = session.query(Operator).one()
        original = account.password_hash
        account.registration_verified_at = None
        session.commit()
    assert login(client).status_code == 403
    assert login(client, password="wrong", code="capstone").status_code == 401
    assert login(client, code="wrong").status_code == 403
    assert login(client, code="capstone").status_code == 200
    with factory() as session:
        account = session.query(Operator).one()
        assert account.password_hash == original
        assert account.registration_verified_at is not None
    assert client.get("/api/auth/me").status_code == 200


def test_disabled_operator_cannot_login(auth_client):
    client, factory = auth_client
    assert register(client).status_code == 201
    with factory() as session:
        account = session.query(Operator).one()
        account.is_active = False
        session.commit()
    assert login(client).status_code == 401


def test_reserved_demo_call_sign_rejected(auth_client):
    client, factory = auth_client
    assert register(client, call_sign="Demo").status_code == 409
    with factory() as session:
        assert session.query(Operator).count() == 0
