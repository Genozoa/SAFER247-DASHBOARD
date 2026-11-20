"""Browser session routing required by the authenticated radio API."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.auth.api import CurrentPrincipal, SESSION_COOKIE
from app.db.models import AuthSession, Operator, OperatorAuth
from app.db.session import create_session_factory, get_db_session
from app.main import create_app


def test_session_cookie_reaches_radio_and_operations_and_logout_clears_paths(monkeypatch):
    monkeypatch.setenv("PASSWORD_FINGERPRINT_SECRET", "radio-cookie-test-secret".ljust(32, "x"))
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Operator.metadata.create_all(
        engine, tables=[Operator.__table__, OperatorAuth.__table__, AuthSession.__table__]
    )
    factory = create_session_factory(engine)
    app = create_app()

    def session_override():
        with factory() as session:
            yield session

    def authenticated_probe(principal: CurrentPrincipal):
        return {"call_sign": principal.operator.username}

    app.dependency_overrides[get_db_session] = session_override
    app.get("/api/radio/auth-cookie-probe")(authenticated_probe)
    app.get("/api/operations/auth-cookie-probe")(authenticated_probe)
    try:
        with TestClient(app) as client:
            client.cookies.set(SESSION_COOKIE, "legacy", path="/api/auth")
            registered = client.post(
                "/api/auth/register",
                json={"call_sign": "N0CALL", "password": "Strong!Pass9"},
            )
            assert registered.status_code == 201
            headers = registered.headers.get_list("set-cookie")
            assert any("Path=/api;" in header and "HttpOnly" in header for header in headers)
            assert any("Path=/api/auth;" in header and "Max-Age=0" in header for header in headers)
            for path in ("/api/radio/auth-cookie-probe", "/api/operations/auth-cookie-probe"):
                result = client.get(path)
                assert result.status_code == 200
                assert result.json() == {"call_sign": "N0CALL"}

            logged_out = client.post("/api/auth/logout")
            assert logged_out.status_code == 204
            cleared = logged_out.headers.get_list("set-cookie")
            for path in ("/api;", "/api/auth;"):
                assert any(f"Path={path}" in header and "Max-Age=0" in header for header in cleared)
            assert client.get("/api/radio/auth-cookie-probe").status_code == 401
    finally:
        engine.dispose()
