"""Starts one radio worker for an API process and requests a clean shutdown."""
from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

from app.radio_lab.settings import RadioSettings
from app.radio_lab.worker_status import WorkerStatusReadError, read_status

_STATUS_MAX_AGE_SECONDS = 8.0


class RadioWorkerSupervisor:
    def __init__(self, settings: RadioSettings, backend_directory: Path):
        self.settings = settings
        self.backend_directory = backend_directory.resolve()
        self.process: subprocess.Popen[str] | None = None
        self.launch_error: str | None = None

    def start(self) -> None:
        if not self.settings.enabled:
            return
        environment = os.environ.copy()
        environment["RADIO_MANAGED_WORKER"] = "1"
        arguments = [sys.executable, "-m", "app.radio_lab.runtime"]
        options: dict[str, Any] = {
            "cwd": self.backend_directory,
            "env": environment,
            "stdin": subprocess.PIPE,
            "text": True,
            "bufsize": 1,
        }
        if os.name == "nt":
            options["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            self.process = subprocess.Popen(arguments, **options)
        except OSError as exc:
            self.launch_error = f"Could not start radio worker: {exc}"

    def stop(self) -> None:
        process = self.process
        if process is None:
            return
        if process.poll() is None and process.stdin is not None:
            try:
                process.stdin.write("STOP\n")
                process.stdin.flush()
            except (BrokenPipeError, OSError):
                pass
        if process.stdin is not None:
            try:
                process.stdin.close()
            except OSError:
                pass
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        self.process = None

    def status(self) -> dict[str, Any]:
        if not self.settings.enabled:
            return {
                "state": "disabled",
                "running": False,
                "process_alive": False,
                "error": None,
                "input_device": None,
                "output_device": None,
                "input_state": "disabled",
                "output_state": "disabled",
            }

        try:
            snapshot = read_status(self.settings.storage_dir) or {}
        except WorkerStatusReadError as exc:
            process = self.process
            process_alive = process is not None and process.poll() is None
            return {
                "state": "error",
                "running": False,
                "process_alive": process_alive,
                "error": str(exc),
            }
        if self.launch_error:
            return {
                **snapshot,
                "state": "error",
                "running": False,
                "process_alive": False,
                "error": self.launch_error,
            }

        updated_at = snapshot.get("updated_at")
        is_fresh = False
        if isinstance(updated_at, str):
            try:
                timestamp = datetime.fromisoformat(updated_at)
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                is_fresh = (datetime.now(timezone.utc) - timestamp).total_seconds() <= _STATUS_MAX_AGE_SECONDS
            except ValueError:
                is_fresh = False

        process = self.process
        if process is not None and process.poll() is not None:
            # A different API process may already own the shared worker lock.
            if not (is_fresh and snapshot.get("state") == "running"):
                return {
                    **snapshot,
                    "state": "error",
                    "running": False,
                    "process_alive": False,
                    "error": snapshot.get("error")
                    or f"Radio worker exited with status {process.returncode}.",
                }
        if not snapshot or not is_fresh:
            if process is not None and process.poll() is None and snapshot.get("state") == "running":
                return {
                    **snapshot,
                    "state": "stale",
                    "running": False,
                    "process_alive": True,
                    "error": "Radio worker heartbeat is stale.",
                }
            return {
                **snapshot,
                "state": "starting",
                "running": False,
                "process_alive": process is not None and process.poll() is None,
                "error": snapshot.get("error"),
            }
        snapshot["running"] = snapshot.get("state") == "running"
        snapshot["process_alive"] = snapshot["running"] or (
            process is not None and process.poll() is None
        )
        snapshot.setdefault("error", None)
        return snapshot
