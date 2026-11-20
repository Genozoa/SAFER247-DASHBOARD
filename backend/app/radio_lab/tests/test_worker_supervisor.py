import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import main as main_module
from app.radio_lab.settings import RadioSettings
from app.radio_lab.worker_status import status_path, write_status
from app.radio_lab.worker_supervisor import RadioWorkerSupervisor


class FakeProcess:
    def __init__(self, *_args, **kwargs):
        self.stdin = FakeStdin()
        self.returncode = None
        self.waited = False
        self.terminated = False
        self.killed = False
        self.kwargs = kwargs

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        self.waited = True
        self.returncode = 0
        return 0

    def terminate(self):
        self.terminated = True

    def kill(self):
        self.killed = True


class FakeStdin:
    def __init__(self):
        self.value = ""
        self.closed = False

    def write(self, value):
        self.value += value

    def flush(self):
        return None

    def close(self):
        self.closed = True


def test_enabled_supervisor_launches_managed_child_and_requests_clean_stop(
    tmp_path, monkeypatch
):
    processes = []

    def fake_popen(*args, **kwargs):
        process = FakeProcess(*args, **kwargs)
        processes.append((args, process))
        return process

    monkeypatch.setattr("app.radio_lab.worker_supervisor.subprocess.Popen", fake_popen)
    supervisor = RadioWorkerSupervisor(
        RadioSettings(enabled=True, storage_dir=tmp_path), Path("backend")
    )

    supervisor.start()
    startup_status = supervisor.status()
    supervisor.stop()

    arguments, process = processes[0]
    assert arguments[0][1:] == ["-m", "app.radio_lab.runtime"]
    assert process.kwargs["env"]["RADIO_MANAGED_WORKER"] == "1"
    assert process.stdin.value == "STOP\n"
    assert process.stdin.closed
    assert process.waited
    assert supervisor.process is None
    assert startup_status["state"] == "starting"
    assert startup_status["process_alive"] is True


def test_disabled_supervisor_does_not_launch_worker(tmp_path, monkeypatch):
    def unexpected_popen(*_args, **_kwargs):
        raise AssertionError("disabled radio must not launch a worker")

    monkeypatch.setattr("app.radio_lab.worker_supervisor.subprocess.Popen", unexpected_popen)
    supervisor = RadioWorkerSupervisor(
        RadioSettings(enabled=False, storage_dir=tmp_path), tmp_path
    )

    supervisor.start()

    assert supervisor.status()["state"] == "disabled"
    assert supervisor.status()["running"] is False


def test_status_write_retries_transient_replace_permission_error(tmp_path, monkeypatch):
    replace = Path.replace
    attempts = 0

    def replace_after_temporary_lock(source, target):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise PermissionError("status file is temporarily locked")
        return replace(source, target)

    monkeypatch.setattr(Path, "replace", replace_after_temporary_lock)

    write_status(tmp_path, {"state": "running"})

    assert attempts == 2
    assert json.loads(status_path(tmp_path).read_text())["state"] == "running"
    assert list(tmp_path.glob("worker-status.json.*.tmp")) == []


def test_supervisor_reports_live_worker_and_active_devices(tmp_path):
    write_status(
        tmp_path,
        {
            "state": "running",
            "pid": 42,
            "enabled": True,
            "input_device": "Built-in Microphone",
            "output_device": "Built-in Speakers",
            "input_state": "listening",
            "output_state": "ready",
        },
    )
    supervisor = RadioWorkerSupervisor(
        RadioSettings(enabled=True, storage_dir=tmp_path), tmp_path
    )

    status = supervisor.status()

    assert status["running"] is True
    assert status["input_device"] == "Built-in Microphone"
    assert status["output_device"] == "Built-in Speakers"


def test_supervisor_reports_stale_heartbeat_while_process_is_alive(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.radio_lab.worker_supervisor.subprocess.Popen",
        lambda *_args, **_kwargs: FakeProcess(),
    )
    write_status(tmp_path, {"state": "running", "input_state": "listening"})
    snapshot = json.loads(status_path(tmp_path).read_text())
    snapshot["updated_at"] = "2000-01-01T00:00:00+00:00"
    status_path(tmp_path).write_text(json.dumps(snapshot))
    supervisor = RadioWorkerSupervisor(
        RadioSettings(enabled=True, storage_dir=tmp_path), tmp_path
    )
    supervisor.start()

    status = supervisor.status()

    supervisor.stop()
    assert status["state"] == "stale"
    assert status["running"] is False
    assert status["process_alive"] is True
    assert "heartbeat" in status["error"].lower()


def test_supervisor_reports_unreadable_status_instead_of_starting(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.radio_lab.worker_supervisor.subprocess.Popen",
        lambda *_args, **_kwargs: FakeProcess(),
    )
    status_path(tmp_path).parent.mkdir(parents=True, exist_ok=True)
    status_path(tmp_path).write_text("{invalid json")
    supervisor = RadioWorkerSupervisor(
        RadioSettings(enabled=True, storage_dir=tmp_path), tmp_path
    )
    supervisor.start()

    status = supervisor.status()

    supervisor.stop()
    assert status["state"] == "error"
    assert status["running"] is False
    assert status["process_alive"] is True
    assert "could not read" in status["error"].lower()


def test_api_lifespan_starts_and_stops_supervisor(monkeypatch):
    instances = []

    class FakeSupervisor:
        def __init__(self, settings, backend_directory):
            self.settings = settings
            self.backend_directory = backend_directory
            self.started = False
            self.stopped = False
            instances.append(self)

        def start(self):
            self.started = True

        def stop(self):
            self.stopped = True

    monkeypatch.setenv("RADIO_ENABLED", "true")
    monkeypatch.setattr(main_module, "RadioWorkerSupervisor", FakeSupervisor)

    with TestClient(main_module.create_app()) as client:
        assert client.get("/openapi.json").status_code == 200
        assert client.app.state.radio_worker_supervisor.started

    assert instances[0].settings.enabled is True
    assert instances[0].backend_directory.name == "backend"
    assert instances[0].stopped is True
