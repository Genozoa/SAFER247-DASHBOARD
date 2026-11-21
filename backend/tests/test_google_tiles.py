"""Google Map Tiles API integration uses a private key and official session API."""
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.api import current_principal
from app.maps import api as maps


@pytest.fixture
def client(monkeypatch):
    maps._sessions.clear()
    monkeypatch.delenv("GOOGLE_MAP_TILES_API_KEY", raising=False)
    app = FastAPI()
    app.include_router(maps.router)
    app.dependency_overrides[current_principal] = lambda: object()
    with TestClient(app) as test_client:
        yield test_client
    maps._sessions.clear()


def test_missing_server_key_fails_closed(client):
    response = client.get("/api/maps/google/roadmap/tiles/11/1700/950")
    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "configuration"


def test_session_uses_clean_roadmap_style_and_reuses_token(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAP_TILES_API_KEY", "TEST_PRIVATE_KEY")
    calls = []

    def fake(method, path, *, params, payload=None):
        calls.append((method, path, params.copy(), payload))
        if path.endswith("createSession"):
            return httpx.Response(200, json={
                "session": "SESSION_TOKEN", "expiry": 9999999999,
            })
        return httpx.Response(200, content=b"PNGDATA", headers={"content-type": "image/png"})

    monkeypatch.setattr(maps, "_google_request", fake)
    for _ in range(2):
        response = client.get("/api/maps/google/roadmap/tiles/0/0/0")
        assert response.status_code == 200
        assert response.content == b"PNGDATA"
        assert "TEST_PRIVATE_KEY" not in str(response.headers)
        assert response.headers["cache-control"] == "private, no-store"
    assert len([c for c in calls if c[1].endswith("createSession")]) == 1
    session = calls[0][3]
    assert session["mapType"] == "roadmap"
    assert session["styles"] == maps._POI_STYLES
    assert session["region"] == "PH"


def test_satellite_and_terrain_sessions_do_not_inherit_roadmap_styles(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAP_TILES_API_KEY", "PRIVATE")
    configs = []

    def fake(method, path, *, params, payload=None):
        if method == "POST":
            configs.append(payload)
            return httpx.Response(200, json={"session": "SESSION", "expiry": 9999999999})
        return httpx.Response(200, content=b"IMG", headers={"content-type": "image/jpeg"})

    monkeypatch.setattr(maps, "_google_request", fake)
    assert client.get("/api/maps/google/satellite/tiles/0/0/0").status_code == 200
    assert client.get("/api/maps/google/terrain/tiles/0/0/0").status_code == 200
    assert "styles" not in configs[0] and "layerTypes" not in configs[0]
    assert configs[1]["layerTypes"] == ["layerRoadmap"]
    assert "styles" not in configs[1]


def test_viewport_copyright_from_provider(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAP_TILES_API_KEY", "PRIVATE")

    def fake(method, path, *, params, payload=None):
        if method == "POST":
            return httpx.Response(200, json={"session": "SESSION", "expiry": 9999999999})
        assert path == "/tile/v1/viewport"
        return httpx.Response(200, json={"copyright": "Map data © Google and partners"})

    monkeypatch.setattr(maps, "_google_request", fake)
    response = client.get(
        "/api/maps/google/roadmap/copyright?zoom=11&north=8&south=7&east=126&west=125"
    )
    assert response.status_code == 200
    assert "Google" in response.json()["copyright"]


def test_quota_failures_have_actionable_reason_not_private_key(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAP_TILES_API_KEY", "PRIVATE")

    def fake(method, path, *, params, payload=None):
        return httpx.Response(429)

    monkeypatch.setattr(maps, "_google_request", fake)
    response = client.get("/api/maps/google/roadmap/tiles/0/0/0")
    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "quota"
    assert "PRIVATE" not in response.text


def test_original_offline_tile_route_is_unchanged(client):
    assert client.get("/api/maps/tiles/0/0/0.png").status_code == 404
