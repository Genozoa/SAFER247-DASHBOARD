"""Opt-in API → DB → codec processes → WAV receive → authenticated media test.

Requires the migrated disposable RADIO_TEST_DATABASE_URL and Dire Wolf CLI.
Live input and output are explicitly disabled so the test never touches hardware.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import sessionmaker

from app.db.models import Message, Operator, Responder, ResponderLocation
from app.db.session import get_engine
from app.main import create_app


def wait_until(predicate, timeout=180):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError("Background radio processing did not complete before the deadline")


def test_authenticated_process_pipeline(tmp_path, monkeypatch):
    url = os.environ.get("RADIO_TEST_DATABASE_URL")
    gen_packets = os.environ.get("RADIO_GEN_PACKETS", "gen_packets")
    atest = os.environ.get("RADIO_ATEST", "atest")
    if not url or not shutil.which(gen_packets) or not shutil.which(atest):
        pytest.skip("Requires disposable migrated PostGIS and RADIO_GEN_PACKETS/RADIO_ATEST")
    pytest.importorskip("open_sstv.core.decoder")
    pytest.importorskip("pysstv")
    from PIL import Image
    from pysstv.color import PD90
    from app.radio_lab.aprs.codec import decode_wav
    station = "T" + uuid4().hex[:5].upper()
    for key, value in {"DATABASE_URL": url, "RADIO_ENABLED": "true", "RADIO_STORAGE_DIR": str(tmp_path),
                       "RADIO_STATION": station, "RADIO_GEN_PACKETS": gen_packets, "RADIO_ATEST": atest,
                       "RADIO_INPUT_ENABLED": "false",
                       "RADIO_OUTPUT_ENABLED": "false",
                       "PASSWORD_FINGERPRINT_SECRET": "pipeline-test-" + uuid4().hex}.items():
        monkeypatch.setenv(key, value)
    for key in ("RADIO_INPUT_COMMAND", "RADIO_OUTPUT_COMMAND", "RADIO_SPOOL_DIR", "RADIO_OUTPUT_DIR"):
        monkeypatch.delenv(key, raising=False)
    get_engine.cache_clear()
    incoming_dir = tmp_path / "incoming"
    incoming_dir.mkdir()
    image_audio = tmp_path / "synthetic-pd90.wav"
    PD90(Image.new("RGB", (320, 256), (230, 60, 20)), 48_000, 16).write_wav(str(image_audio))
    image_audio.replace(incoming_dir / "synthetic-pd90.wav")
    operator_id = None
    try:
        with TestClient(create_app()) as client:
            registered = client.post("/api/auth/register", json={"call_sign": station, "password": "Pipeline!Pass9"})
            assert registered.status_code == 201, registered.text
            operator_id = registered.json()["id"]
            assert client.get("/api/radio/status").status_code == 200
            responses = [client.post("/api/radio/transmissions", json=payload) for payload in (
                {"kind": "text", "text": "Request assistance"},
                {"kind": "position", "latitude": 7.9186, "longitude": 125.3286, "text": "Patrol"},
            )]
            assert all(response.status_code == 202 for response in responses), [r.text for r in responses]
            identifiers = {response.json()["id"] for response in responses}
            def spooled():
                rows = [r for r in client.get("/api/radio/messages").json() if r["id"] in identifiers]
                return rows if len(rows) == 2 and all(
                    r["status"] == "queued" and "WAV file created" in r["status_detail"]
                    for r in rows
                ) else None
            outgoing = wait_until(spooled)
            assert all(r["delivery"] == "wav-file" for r in outgoing)
            assert all("not transmitted" in row["status_detail"].lower() for row in outgoing)
            for row in outgoing:
                recovered = decode_wav(tmp_path / "outgoing" / f"{row['id']}.wav", atest=atest)
                assert recovered[0]["kind"] == row["kind"]
            # A second worker must refuse ownership of this same shared queue.
            duplicate = subprocess.run([sys.executable, "-m", "app.radio_lab.runtime"],
                                       env=os.environ.copy(), capture_output=True, text=True, timeout=15)
            assert duplicate.returncode != 0 and "already owns" in duplicate.stderr
            for row in outgoing:
                temporary = incoming_dir / f"{row['id']}.tmp"
                shutil.copyfile(tmp_path / "outgoing" / f"{row['id']}.wav", temporary)
                temporary.replace(temporary.with_suffix(".wav"))
            def received():
                rows = [r for r in client.get("/api/radio/messages").json() if r["direction"] == "incoming"]
                return rows if {r["kind"] for r in rows} >= {"text", "position", "image"} else None
            incoming = wait_until(received)
            received_image = next(row for row in incoming if row["kind"] == "image")
            assert received_image["station"] == "SSTV-UNKNOWN"
            assert received_image["mode"] == "PD90"
            for variant in ("original_url", "enhanced_url"):
                media = client.get(received_image[variant])
                assert media.status_code == 200 and media.content.startswith(b"\x89PNG")
                with Image.open(io.BytesIO(media.content)) as frame:
                    assert frame.size == (320, 256)
            assert client.get("/api/operations/messages").status_code == 200
            assert client.post("/api/auth/logout").status_code == 204
            assert client.get(received_image["original_url"]).status_code == 401
    finally:
        engine = create_engine(url)
        factory = sessionmaker(engine)
        with factory.begin() as db:
            responders = db.scalars(select(Responder).where(Responder.call_sign.in_([station, "SSTV-UNKNOWN"]))).all()
            for responder in responders:
                db.execute(delete(ResponderLocation).where(ResponderLocation.responder_id == responder.id))
                db.execute(delete(Message).where(Message.sender_responder_id == responder.id))
                db.delete(responder)
            if operator_id:
                operator = db.scalar(select(Operator).where(Operator.username == station))
                if operator:
                    db.execute(delete(Message).where(Message.sender_operator_id == operator.id))
                    db.delete(operator)
        engine.dispose()
        get_engine().dispose()
        get_engine.cache_clear()
