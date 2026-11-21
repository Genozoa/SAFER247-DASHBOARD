"""Authenticated local XYZ tile serving; no remote tile download."""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.auth.api import CurrentPrincipal

router = APIRouter(prefix="/api/maps", tags=["maps"])


@router.get("/tiles/{z}/{x}/{y}.png")
def local_tile(z: int, x: int, y: int, _: CurrentPrincipal):
    if not 0 <= z <= 18 or not (0 <= x < 2 ** z and 0 <= y < 2 ** z):
        raise HTTPException(status_code=404, detail="Tile coordinates outside bounds.")
    configured = os.environ.get("OFFLINE_TILE_DIR", "").strip()
    if not configured:
        raise HTTPException(status_code=404, detail="Offline tile pack not installed.")
    path = Path(configured).resolve() / str(z) / str(x) / f"{y}.png"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Offline tile unavailable.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


"""Official Google Map Tiles API, proxied for signed-in Leaflet users.

Google tiles are never saved to the offline directory or an application cache.
Session tokens are kept on the server, with a private API key. Each provider
request has a bounded timeout and failures have stable, non-secret reason codes.
"""
import os
import time
from threading import RLock

import httpx
from fastapi import HTTPException, Query
from fastapi.responses import Response

_GOOGLE_API = "https://tile.googleapis.com"
_GOOGLE_STYLES = ("roadmap", "satellite", "terrain")
_POI_STYLES = [
    {"featureType": "poi", "elementType": "labels", "stylers": [{"visibility": "off"}]},
    {"featureType": "transit.station", "elementType": "labels",
     "stylers": [{"visibility": "off"}]},
]
_sessions: dict[str, tuple[str, float]] = {}
_session_lock = RLock()


def _google_request(method: str, path: str, *, params: dict, payload: dict | None = None):
    """One bounded upstream request. Replace in tests; never print API key/URLs."""
    try:
        with httpx.Client(timeout=8.0, follow_redirects=False) as client:
            return client.request(
                method, _GOOGLE_API + path, params=params, json=payload,
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail={
            "reason": "timeout", "message": "Google Map Tiles API timed out.",
        }) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail={
            "reason": "network", "message": "The API server could not reach Google Maps.",
        }) from exc


def _check_google_response(response) -> None:
    if response.status_code < 400:
        return
    if response.status_code in (401, 403):
        status, reason, message = 503, "authorization", "Google Maps API authorization failed."
    elif response.status_code == 429:
        status, reason, message = 503, "quota", "Google Maps quota or request limit reached."
    elif response.status_code in (400, 404):
        status, reason, message = 502, "provider_request", "Google Maps rejected the tile request."
    else:
        status, reason, message = 502, "provider", "Google Maps could not supply the requested tiles."
    raise HTTPException(status_code=status, detail={"reason": reason, "message": message})


def _google_key() -> str:
    key = os.environ.get("GOOGLE_MAP_TILES_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail={
            "reason": "configuration",
            "message": "Google Map Tiles API key is not configured on the server.",
        })
    return key


def _session_for(style: str) -> tuple[str, str]:
    if style not in _GOOGLE_STYLES:
        raise HTTPException(status_code=404, detail="Unknown map style.")
    key = _google_key()
    with _session_lock:
        existing = _sessions.get(style)
        if existing and existing[1] > time.time() + 90:
            return existing[0], key
        payload = {"mapType": style, "language": "en-US", "region": "PH"}
        if style == "roadmap":
            payload["styles"] = _POI_STYLES
        elif style == "terrain":
            payload["layerTypes"] = ["layerRoadmap"]
        # Pure satellite imagery intentionally has no roadmap label overlay.
        response = _google_request(
            "POST", "/v1/createSession", params={"key": key}, payload=payload,
        )
        _check_google_response(response)
        try:
            data = response.json()
            token = data["session"]
            expiry = float(data["expiry"])
            if not isinstance(token, str) or not token:
                raise ValueError("Session token missing")
        except (ValueError, KeyError, TypeError) as exc:
            raise HTTPException(status_code=502, detail={
                "reason": "provider", "message": "Google Maps returned an invalid session.",
            }) from exc
        _sessions[style] = (token, expiry)
        return token, key


@router.get("/google/{style}/tiles/{z}/{x}/{y}")
def google_map_tile(
    style: str, z: int, x: int, y: int, _: CurrentPrincipal,
) -> Response:
    if z < 0 or z > 18 or x < 0 or y < 0 or x >= 2 ** z or y >= 2 ** z:
        raise HTTPException(status_code=404, detail="Tile coordinates outside bounds.")
    token, key = _session_for(style)
    response = _google_request(
        "GET", f"/v1/2dtiles/{z}/{x}/{y}",
        params={"session": token, "key": key},
    )
    _check_google_response(response)
    kind = response.headers.get("content-type", "").split(";", 1)[0].strip()
    if kind not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=502, detail={
            "reason": "provider", "message": "Google Maps did not return an image tile.",
        })
    return Response(response.content, media_type=kind, headers={
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    })


@router.get("/google/{style}/copyright")
def google_map_copyright(
    style: str, _: CurrentPrincipal,
    zoom: int = Query(ge=0, le=18),
    north: float = Query(gt=-90, lt=90),
    south: float = Query(gt=-90, lt=90),
    east: float = Query(ge=-180, le=180),
    west: float = Query(ge=-180, le=180),
):
    if south >= north:
        raise HTTPException(status_code=422, detail="Invalid viewport bounds.")
    token, key = _session_for(style)
    response = _google_request(
        "GET", "/tile/v1/viewport", params={
            "session": token, "key": key, "zoom": zoom,
            "north": north, "south": south, "east": east, "west": west,
        },
    )
    _check_google_response(response)
    try:
        attribution = response.json()["copyright"]
        if not isinstance(attribution, str) or not attribution:
            raise ValueError("Missing copyright")
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail={
            "reason": "provider", "message": "Google Maps attribution was unavailable.",
        }) from exc
    return {"copyright": attribution}
