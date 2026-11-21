"""Regression tests for the authenticated local XYZ map tile endpoint."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.auth.api import current_principal
from app.db.session import get_db_session
from app.maps.api import router


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.delenv("OFFLINE_TILE_DIR", raising=False)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[current_principal] = lambda: object()
    with TestClient(app) as test_client:
        yield test_client


def test_no_offline_pack_returns_404(client):
    assert client.get("/api/maps/tiles/0/0/0.png").status_code == 404


def test_local_tile_served_from_configured_pack(client, tmp_path, monkeypatch):
    tile_dir = tmp_path / "11" / "1738"
    tile_dir.mkdir(parents=True)
    contents = b"test-private-png-tile"
    (tile_dir / "977.png").write_bytes(contents)
    monkeypatch.setenv("OFFLINE_TILE_DIR", str(tmp_path))

    response = client.get("/api/maps/tiles/11/1738/977.png")
    assert response.status_code == 200
    assert response.content == contents
    assert response.headers["content-type"] == "image/png"


def test_out_of_bounds_tile_is_rejected(client):
    assert client.get("/api/maps/tiles/1/2/0.png").status_code == 404
    assert client.get("/api/maps/tiles/19/0/0.png").status_code == 404


def test_local_tiles_require_authentication():
    app = FastAPI()
    app.include_router(router)
    # No token should be rejected before any database query is needed.
    app.dependency_overrides[get_db_session] = lambda: object()
    with TestClient(app) as client:
        assert client.get("/api/maps/tiles/0/0/0.png").status_code == 401
