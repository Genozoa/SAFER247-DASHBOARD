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
