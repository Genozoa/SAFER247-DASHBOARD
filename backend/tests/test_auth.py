import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.auth import seed_demo
from app.auth.security import password_policy_errors
from app.db.models import AuthSession, Operator, OperatorAuth
from app.db.session import create_session_factory, get_db_session
from app.main import create_app


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PASSWORD_FINGERPRINT_SECRET", "test-secret-key-".ljust(32, "x"))
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tables = [Operator.__table__, OperatorAuth.__table__, AuthSession.__table__]
    Operator.metadata.create_all(engine, tables=tables)
    factory = create_session_factory(engine)
    app = create_app()

    def override_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_session
    with TestClient(app) as client:
        yield client, factory
    engine.dispose()


def register(client: TestClient, call_sign="DEMO-1", password="Strong!Pass9"):
    return client.post(
        "/api/auth/register",
        json={
            "call_sign": call_sign,
            "password": password,
        },
    )


def test_password_policy_requires_all_character_types() -> None:
    assert password_policy_errors("short") == [
        "at least 8 characters",
        "an uppercase letter",
        "a number",
        "a special character",
    ]
    assert password_policy_errors("Strong!Pass9") == []


def test_registration_password_validation(auth_client) -> None:
    client, _ = auth_client

    invalid_password = register(client, password="weakpass")
    assert invalid_password.status_code == 422
    assert "uppercase letter" in invalid_password.json()["detail"]


def test_register_login_logout_and_session_revocation(auth_client) -> None:
    client, factory = auth_client
    assert client.get("/api/auth/me").status_code == 401
    with factory() as session:
        assert session.query(Operator).count() == 0

    response = register(client)
    assert response.status_code == 201
    assert response.json()["call_sign"] == "DEMO-1"
    assert "display_name" not in response.json()
    assert response.headers["set-cookie"].lower().find("httponly") >= 0
    with factory() as session:
        auth_record = session.query(OperatorAuth).one()
        assert auth_record.password_fingerprint != "Strong!Pass9"
        operator = session.query(Operator).one()
        assert operator.username == response.json()["call_sign"]
        assert operator.password_hash != "Strong!Pass9"
        assert "display_name" not in Operator.__table__.c
    assert client.get("/api/auth/me").json()["call_sign"] == "DEMO-1"

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    with factory() as session:
        assert session.query(AuthSession).count() == 0

    login_response = client.post(
        "/api/auth/login",
        json={"call_sign": "DEMO-1", "password": "Strong!Pass9"},
    )
    assert login_response.status_code == 200
    assert client.get("/api/auth/me").status_code == 200
    assert client.post(
        "/api/auth/login",
        json={"call_sign": "DEMO-1", "password": "wrong"},
    ).status_code == 401


def test_same_password_cannot_be_registered_twice(auth_client) -> None:
    client, _ = auth_client
    assert register(client, "OP-1").status_code == 201
    response = register(client, "OP-2")
    assert response.status_code == 409
    assert response.json()["detail"] == "This password is taken."


def test_authenticated_operator_can_change_call_sign(auth_client) -> None:
    client, factory = auth_client
    assert register(client).status_code == 201
    assert register(client, "OTHER-1", "Other!Password8").status_code == 201
    duplicate = client.patch(
        "/api/auth/me/call-sign",
        json={"call_sign": "DEMO-1"},
    )
    assert duplicate.status_code == 409

    response = client.patch(
        "/api/auth/me/call-sign",
        json={"call_sign": "NEW-CALLSIGN"},
    )
    assert response.status_code == 200
    assert response.json()["call_sign"] == "NEW-CALLSIGN"
    assert client.get("/api/auth/me").json()["call_sign"] == "NEW-CALLSIGN"
    with factory() as session:
        assert session.query(Operator).filter_by(username="NEW-CALLSIGN").one()
    assert client.patch(
        "/api/auth/me/call-sign", json={"call_sign": " "}
    ).status_code == 422


def test_demo_seed_is_idempotent_and_does_not_replace_accounts(
    auth_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, factory = auth_client
    monkeypatch.setattr(seed_demo, "get_engine", lambda: factory.kw["bind"])

    assert seed_demo.seed_demo_operator("DEMO-OP", "Demo!Pass123") is True
    assert seed_demo.seed_demo_operator("DEMO-OP", "Demo!Pass123") is False
    with pytest.raises(ValueError, match="different account"):
        seed_demo.seed_demo_operator("DEMO-OP", "Another!Pass123")

    with factory() as session:
        operator = session.query(Operator).filter_by(username="DEMO-OP").one()
        assert operator.password_hash != "Demo!Pass123"
        assert operator.auth_metadata is not None


def test_demo_seed_requires_explicit_opt_in_and_refuses_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sys, "argv", ["seed_demo"])
    with pytest.raises(SystemExit):
        seed_demo.main()

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(sys, "argv", ["seed_demo", "--confirm-demo-seed"])
    with pytest.raises(SystemExit):
        seed_demo.main()
