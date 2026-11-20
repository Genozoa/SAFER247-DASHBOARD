"""Atomic status snapshots shared by the API process and radio worker."""
from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import threading
import time
from typing import Any

_write_lock = threading.Lock()
_REPLACE_ATTEMPTS = 5
_REPLACE_RETRY_DELAY_SECONDS = 0.05


class WorkerStatusReadError(RuntimeError):
    pass


def status_path(storage_dir: Path) -> Path:
    return storage_dir / "worker-status.json"


def write_status(storage_dir: Path, snapshot: dict[str, Any]) -> None:
    storage_dir.mkdir(parents=True, exist_ok=True)
    path = status_path(storage_dir)
    payload = dict(snapshot)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    with _write_lock:
        temporary.write_text(json.dumps(payload, default=str), encoding="utf-8")
        try:
            for attempt in range(_REPLACE_ATTEMPTS):
                try:
                    temporary.replace(path)
                    break
                except PermissionError:
                    if attempt + 1 == _REPLACE_ATTEMPTS:
                        raise
                    time.sleep(_REPLACE_RETRY_DELAY_SECONDS * (attempt + 1))
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass


def read_status(storage_dir: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(status_path(storage_dir).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WorkerStatusReadError(f"Could not read radio worker status: {exc}") from exc
    if not isinstance(payload, dict):
        raise WorkerStatusReadError("Could not read radio worker status: expected a JSON object.")
    return payload
