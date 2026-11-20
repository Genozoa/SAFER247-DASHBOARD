"""API boundary tests and opt-in real PostgreSQL/PostGIS queue tests.

RADIO_TEST_DATABASE_URL must point to a disposable database migrated with the
project's Alembic migrations. These tests never open an audio device or radio.
"""
from dataclasses import replace
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import sessionmaker

from app.auth.api import current_principal
from app.db.models import (
    ImageEnhancement, MediaAttachment, Message, MessageTransmissionAttempt,
    Operator, Responder, ResponderLocation,
)
from app.db.session import get_db_session
from app.radio_lab.api import get_radio_settings, router
from app.radio_lab.repository import RadioRepository, radio_data
from app.radio_lab.schemas import TransmissionRequest
from app.radio_lab.settings import RadioSettings


@pytest.fixture
def api_client(tmp_path):
    app = FastAPI()
    app.include_router(router)
    db = Mock()
    app.dependency_overrides[get_db_session] = lambda: db
    settings = RadioSettings(enabled=True, storage_dir=tmp_path)
    app.dependency_overrides[get_radio_settings] = lambda: settings
    with TestClient(app) as client:
        yield client, app, db


def authenticate(app):
    app.dependency_overrides[current_principal] = lambda: SimpleNamespace(
        operator=SimpleNamespace(id=uuid4(), username="TEST"))


@pytest.mark.parametrize("path,method", [
    ("/api/radio/status", "get"), ("/api/radio/messages", "get"),
    (f"/api/radio/media/{uuid4()}", "get"),
    (f"/api/radio/transmissions/{uuid4()}/retry", "post"),
])
def test_radio_endpoints_require_existing_operator_session(api_client, path, method):
    client, _, _ = api_client
    assert getattr(client, method)(path).status_code == 401


def test_disabled_transmission_is_persisted_as_not_transmitted(api_client):
    client, app, db = api_client
    authenticate(app)
    app.dependency_overrides[get_radio_settings] = lambda: RadioSettings(enabled=False)
    response = client.post("/api/radio/transmissions", json={"kind": "text", "text": "Help"})
    assert response.status_code == 202
    assert response.json()["status"] == "queued"
    assert "not transmitted" in response.json()["status_detail"].lower()
    db.add.assert_called_once()


def test_status_does_not_claim_hardware_or_android_verification(api_client):
    client, app, _ = api_client
    authenticate(app)
    result = client.get("/api/radio/status").json()
    assert result["hardware_verified"] is False
    assert result["android_verified"] is False
    assert result["delivery"] == "wav-file"
    assert result["audio_output_configured"] is False


@pytest.mark.parametrize("payload", [
    {"kind": "text", "text": ""}, {"kind": "text", "text": "A" * 68},
    {"kind": "text", "text": "Unicode 📻"}, {"kind": "text", "text": "line\nbreak"},
    {"kind": "text", "text": "protocol{delimiter"},
    {"kind": "text", "text": "Hi", "latitude": 1},
    {"kind": "position", "latitude": 91, "longitude": 0},
    {"kind": "position", "latitude": 0},
    {"kind": "position", "latitude": 0, "longitude": 0, "text": "x" * 44},
    {"kind": "image", "image_base64": "not-base64"},
    {"kind": "incident", "image_base64": "YQ=="},
    {"kind": "text", "text": "Hi", "unexpected": True},
])
def test_invalid_transport_payload_rejected_before_queue(api_client, payload):
    client, app, db = api_client
    authenticate(app)
    assert client.post("/api/radio/transmissions", json=payload).status_code == 422
    db.add.assert_not_called()


@pytest.mark.parametrize("payload", [
    {"kind": "text", "text": "ack123"},
    {"kind": "position", "latitude": 90, "longitude": 0},
])
def test_codec_incompatibilities_rejected_before_queue(api_client, payload):
    client, app, db = api_client
    authenticate(app)
    assert client.post("/api/radio/transmissions", json=payload).status_code == 422
    db.add.assert_not_called()


def test_nonfinite_coordinates_rejected():
    with pytest.raises(ValidationError):
        TransmissionRequest(kind="position", latitude=float("nan"), longitude=0)
    with pytest.raises(ValidationError):
        TransmissionRequest(kind="position", latitude=0, longitude=float("inf"))


def test_legacy_image_transmission_cannot_be_retried():
    db = Mock()
    message = SimpleNamespace(
        id=uuid4(), direction="outgoing", transmission_status="failed",
        decoded_payload={"radio_lab": {"kind": "image"}},
    )
    db.scalar.return_value = message
    with pytest.raises(ValueError, match="Only APRS text or position"):
        RadioRepository(None, RadioSettings()).retry(db, message.id)
    db.commit.assert_not_called()


def test_media_path_cannot_escape_storage(api_client, tmp_path):
    client, app, db = api_client
    authenticate(app)
    outside = tmp_path.parent / f"{uuid4()}.png"
    outside.write_bytes(b"private")
    db.scalar.return_value = SimpleNamespace(storage_path=str(outside), enhancements=[], mime_type="image/png")
    try:
        assert client.get(f"/api/radio/media/{uuid4()}").status_code == 404
    finally:
        outside.unlink()


@pytest.mark.parametrize("data,expected_mode", [
    ({"kind": "image", "mode": "PD90"}, "PD90"),
    ({"kind": "image", "raw": {"mode": "Robot36"}}, "Robot36"),
    ({"kind": "image", "raw": "historical decoder metadata"}, None),
    ({"kind": "image"}, None),
    ({"kind": "text", "mode": "PD90"}, None),
    ({"kind": "position", "raw": {"mode": "Robot36"}}, None),
])
def test_record_view_preserves_recorded_image_mode_without_relabeling(data, expected_mode):
    payload = {"radio_lab": {"version": 1, "stage": "queued", **data}}
    before = repr(payload)
    message = SimpleNamespace(id=uuid4(), decoded_payload=payload, media_attachments=[],
                              direction="incoming", transmission_status="received",
                              body="Historical image", created_at=None)
    assert RadioRepository.view(message)["mode"] == expected_mode
    assert repr(payload) == before


def test_radio_worker_transitions_audio_to_unconfirmed_not_delivered():
    identifier = uuid4()
    message = SimpleNamespace(
        id=identifier,
        decoded_payload={"radio_lab": {"version": 1, "stage": "preparing", "kind": "text"}},
        transmission_status="preparing",
        sent_at=None,
        direction="outgoing",
        body="Check in",
        created_at=None,
        media_attachments=[],
    )
    attempt = SimpleNamespace(status="preparing", result_details=None)
    database = Mock()
    database.get.return_value = message
    database.scalar.return_value = attempt
    factory = MagicMock()
    factory.begin.return_value.__enter__.return_value = database
    repository = RadioRepository(factory, RadioSettings())

    repository.mark_sending(identifier)
    assert message.transmission_status == "sending"
    assert attempt.status == "sending"

    repository.finish(identifier, {
        "audio_complete": True,
        "delivered": True,
        "delivery": "audio-output",
    })

    assert message.transmission_status == "audio_complete"
    assert attempt.status == "audio_complete"
    assert RadioRepository.view(message)["status"] == "audio_complete"
    assert "unconfirmed" in RadioRepository.view(message)["status_detail"]


def test_failure_after_audio_starts_is_delivery_unknown_without_auto_retry():
    identifier = uuid4()
    message = SimpleNamespace(
        id=identifier,
        decoded_payload={"radio_lab": {"version": 1, "stage": "sending", "kind": "text"}},
        transmission_status="sending",
        direction="outgoing",
        body="Check in",
        created_at=None,
        media_attachments=[],
    )
    attempt = SimpleNamespace(status="sending", result_details=None)
    database = Mock()
    database.get.return_value = message
    database.scalar.return_value = attempt
    factory = MagicMock()
    factory.begin.return_value.__enter__.return_value = database
    repository = RadioRepository(factory, RadioSettings())

    repository.fail(identifier, "Audio output interrupted")

    assert message.transmission_status == "delivery_unknown"
    assert attempt.status == "delivery_unknown"
    assert "Delivery is unknown" in RadioRepository.view(message)["status_detail"]

    database.scalar.return_value = message
    repository.retry(database, identifier)
    assert message.transmission_status == "queued"
    assert radio_data(message)["stage"] == "queued"


def test_worker_recovery_distinguishes_preparation_from_possible_output():
    preparing = SimpleNamespace(
        id=uuid4(),
        decoded_payload={"radio_lab": {"version": 1, "stage": "preparing"}},
        transmission_status="preparing",
    )
    sending = SimpleNamespace(
        id=uuid4(),
        decoded_payload={"radio_lab": {"version": 1, "stage": "sending"}},
        transmission_status="sending",
    )
    preparation_attempt = SimpleNamespace(status="preparing", result_details=None)
    sending_attempt = SimpleNamespace(status="sending", result_details=None)
    database = Mock()
    database.scalars.return_value.all.return_value = [preparing, sending]
    database.scalar.side_effect = [preparation_attempt, sending_attempt]
    factory = MagicMock()
    factory.begin.return_value.__enter__.return_value = database
    repository = RadioRepository(factory, RadioSettings())

    assert repository.recover_interrupted() == 2
    assert preparing.transmission_status == "failed"
    assert sending.transmission_status == "delivery_unknown"
    assert "before audio output" in preparation_attempt.result_details
    assert "delivery is unknown" in sending_attempt.result_details


@pytest.fixture
def postgres_radio(tmp_path):
    url = os.environ.get("RADIO_TEST_DATABASE_URL")
    if not url:
        pytest.skip("RADIO_TEST_DATABASE_URL is not set; a migrated disposable PostGIS database is required")
    engine = create_engine(url)
    factory = sessionmaker(engine, expire_on_commit=False)
    station = "T" + uuid4().hex[:5].upper()
    settings = RadioSettings(enabled=True, station=station, storage_dir=tmp_path)
    operator_id = uuid4()
    with factory.begin() as db:
        db.add(Operator(id=operator_id, username=f"radio-test-{operator_id}",
                        password_hash="unused-test-hash", is_active=True))
    repository = RadioRepository(factory, settings)
    try:
        yield factory, repository, settings, operator_id
    finally:
        with factory.begin() as db:
            responder = db.scalar(select(Responder).where(Responder.call_sign == station))
            if responder:
                db.execute(delete(ResponderLocation).where(ResponderLocation.responder_id == responder.id))
                db.execute(delete(Message).where(Message.sender_responder_id == responder.id))
                db.delete(responder)
            db.execute(delete(Message).where(Message.sender_operator_id == operator_id))
            db.execute(delete(Operator).where(Operator.id == operator_id))
        engine.dispose()


def enqueue_text(factory, repository, operator_id, text="Request assistance"):
    with factory() as db:
        return repository.enqueue(db, operator_id, {"kind": "text", "text": text}).id


def test_postgis_durable_shared_queue_and_encode_only_status(postgres_radio):
    factory, repository, settings, operator_id = postgres_radio
    identifier = enqueue_text(factory, repository, operator_id)
    job = repository.claim_next()
    assert job["id"] == str(identifier)
    assert job["kind"] == "text"
    assert job["station"] == settings.station
    assert repository.claim_next() is None
    repository.finish(identifier, {"sent": False, "delivery": "wav-file", "audio_path": "software-only.wav"})
    assert repository.claim_next() is None  # encoded artifacts are never automatically replayed
    with factory() as db:
        row = repository.get_message(db, identifier)
        assert row.transmission_status == "queued"
        assert repository.view(row)["status"] == "queued"
        assert "WAV file created" in repository.view(row)["status_detail"]
        assert row.sent_at is None
        attempt = db.scalar(select(MessageTransmissionAttempt).where(MessageTransmissionAttempt.message_id == identifier))
        assert attempt.status == "queued"
        assert "no audio output" in attempt.result_details


def test_postgis_failed_and_interrupted_transmissions_require_explicit_retry(postgres_radio):
    factory, repository, _, operator_id = postgres_radio
    identifier = enqueue_text(factory, repository, operator_id)
    repository.claim_next()
    assert repository.recover_interrupted() == 1
    assert repository.claim_next() is None
    with factory() as db:
        row = repository.get_message(db, identifier)
        assert row.transmission_status == "failed"
        assert "before audio output began" in radio_data(row)["error"]
        repository.retry(db, identifier)
    assert repository.claim_next()["id"] == str(identifier)
    repository.fail(identifier, "Audio output interrupted")
    with factory() as db:
        attempts = db.scalars(select(MessageTransmissionAttempt).where(
            MessageTransmissionAttempt.message_id == identifier).order_by(MessageTransmissionAttempt.attempt_number)).all()
        assert [item.status for item in attempts] == ["failed", "failed"]


def test_postgis_audio_completion_never_claims_delivery_without_ack(postgres_radio):
    factory, repository, _, operator_id = postgres_radio
    identifier = enqueue_text(factory, repository, operator_id)
    repository.claim_next()
    repository.mark_sending(identifier)
    repository.finish(identifier, {
        "audio_complete": True,
        "sent": True,
        "delivered": True,
        "delivery": "audio-output",
        "audio_path": "test.wav",
    })
    with factory() as db:
        row = repository.get_message(db, identifier)
        assert row.transmission_status == "audio_complete"
        assert row.sent_at is not None
        assert radio_data(row)["delivery"] == "audio-output"
        assert repository.view(row)["status"] == "audio_complete"
        assert "unconfirmed" in repository.view(row)["status_detail"]


def test_postgis_skip_locked_claims_do_not_wait_for_other_claims(postgres_radio):
    factory, repository, _, operator_id = postgres_radio
    first = enqueue_text(factory, repository, operator_id, "First")
    second = enqueue_text(factory, repository, operator_id, "Second")
    with factory.begin() as held:
        held.scalar(select(Message).where(Message.id == first).with_for_update())
        assert repository.claim_next()["id"] == str(second)
    assert repository.claim_next()["id"] == str(first)
    repository.fail(first, "Test cleanup")
    repository.fail(second, "Test cleanup")


def test_postgis_incoming_positions_reuse_geospatial_models(postgres_radio):
    factory, repository, settings, _ = postgres_radio
    identifier = UUID(repository.receive({"kind": "position", "station": settings.station,
                                         "latitude": 7.9186, "longitude": 125.3286,
                                         "text": "Location beacon", "raw": "test packet"}))
    with factory() as db:
        row = repository.get_message(db, identifier)
        assert row.transmission_status == "received"
        location = db.scalar(select(ResponderLocation).where(ResponderLocation.received_message_id == identifier))
        assert location is not None
        coordinate = db.execute(select(func.ST_AsText(Message.location)).where(Message.id == identifier)).scalar_one()
        assert coordinate == "POINT(125.3286 7.9186)"
        assert repository.view(row)["latitude"] == 7.9186


def test_postgis_receipt_replay_does_not_duplicate_partially_committed_batch(postgres_radio):
    factory, repository, settings, _ = postgres_radio
    result = {"kind": "position", "station": settings.station, "latitude": 7.9,
              "longitude": 125.3, "text": "Beacon", "receipt_id": f"wav-{uuid4()}-0"}
    first = repository.receive(result)
    assert repository.receive(result) == first
    with factory() as db:
        rows = db.scalars(select(ResponderLocation).where(
            ResponderLocation.received_message_id == UUID(first))).all()
        assert len(rows) == 1


def test_received_image_copy_cannot_overwrite_original(postgres_radio, tmp_path):
    _, repository, _, _ = postgres_radio
    source = tmp_path / "source.png"
    source.write_bytes(b"first original")
    identifier = uuid4()
    destination = repository._copy_media(source, "originals", identifier)
    source.write_bytes(b"replacement")
    with pytest.raises(FileExistsError):
        repository._copy_media(source, "originals", identifier)
    assert Path(destination).read_bytes() == b"first original"


def test_postgis_received_original_and_enhancement_remain_separate(postgres_radio, tmp_path):
    factory, repository, settings, _ = postgres_radio
    original = tmp_path / "decoded-original.png"
    enhanced = tmp_path / "enhanced-copy.png"
    original.write_bytes(b"original image content")
    enhanced.write_bytes(b"enhanced image content")
    identifier = UUID(repository.receive({"kind": "image", "station": settings.station,
                                         "original_path": str(original), "enhanced_path": str(enhanced)}))
    with factory() as db:
        row = repository.get_message(db, identifier)
        attachment = row.media_attachments[0]
        enhancement = attachment.enhancements[0]
        assert Path(attachment.storage_path).read_bytes() == b"original image content"
        assert Path(enhancement.enhanced_storage_path).read_bytes() == b"enhanced image content"
        assert attachment.storage_path != enhancement.enhanced_storage_path
        view = repository.view(row)
        assert view["original_url"].endswith("?variant=original")
        assert view["enhanced_url"].endswith("?variant=enhanced")


@pytest.mark.parametrize("mode", ["PD90", "Robot36", None])
def test_postgis_received_image_retains_actual_or_unknown_mode(postgres_radio, tmp_path, mode):
    factory, repository, settings, _ = postgres_radio
    original = tmp_path / "mode-original.png"
    original.write_bytes(b"preserved decoded image content")
    raw = {"mode": mode} if mode else None
    identifier = UUID(repository.receive({"kind": "image", "station": settings.station,
                                         "original_path": str(original), "raw": raw}))
    with factory() as db:
        row = repository.get_message(db, identifier)
        assert radio_data(row)["mode"] == mode
        assert repository.view(row)["mode"] == mode
        assert (f"{mode} image" if mode else "mode unknown") in row.body
        assert Path(row.media_attachments[0].storage_path).read_bytes() == original.read_bytes()


def test_postgis_authenticated_api_queues_without_audio_processing(postgres_radio, monkeypatch):
    factory, _, settings, operator_id = postgres_radio
    app = FastAPI()
    app.include_router(router)
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db_session] = database
    app.dependency_overrides[get_radio_settings] = lambda: settings
    app.dependency_overrides[current_principal] = lambda: SimpleNamespace(operator=SimpleNamespace(id=operator_id))
    def no_subprocess(*args, **kwargs):
        raise AssertionError("Request handlers must not process audio")
    monkeypatch.setattr("subprocess.run", no_subprocess)
    with TestClient(app) as client:
        response = client.post("/api/radio/transmissions", json={"kind": "text", "text": "Assistance requested"})
        assert response.status_code == 202
        assert response.json()["status"] == "queued"
        assert client.get("/api/radio/messages").json()[0]["text"] == "Assistance requested"
