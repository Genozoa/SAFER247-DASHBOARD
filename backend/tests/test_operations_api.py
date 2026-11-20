from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.api import current_principal
from app.db.session import get_db_session
from app.main import create_app


@pytest.fixture
def operations_client():
    db = Mock()
    db.get_bind.return_value.dialect.name = "sqlite"
    operator = SimpleNamespace(id=uuid4(), username="COMMAND-1")
    principal = SimpleNamespace(operator=operator)
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[current_principal] = lambda: principal
    with TestClient(app) as client:
        yield client, db, operator
    app.dependency_overrides.clear()


def test_list_incidents_maps_database_fields_to_frontend_shape(
    operations_client,
) -> None:
    client, db, _ = operations_client
    reported_at = datetime(2026, 11, 16, 10, 30, tzinfo=timezone.utc)
    report = SimpleNamespace(
        id=uuid4(),
        report_code="SF-2026-001",
        location_description="Sample riverside",
        reported_at=reported_at,
        details="Water level rising.",
        status="received",
        media_attachments=[object()],
    )
    db.execute.return_value.all.return_value = [
        (report, "Flood", "UNIT-2", "Halapitan", 7.9186, 125.3286)
    ]

    response = client.get("/api/operations/incidents")

    assert response.status_code == 200
    incident = response.json()[0]
    assert incident["reportCode"] == "SF-2026-001"
    assert incident["type"] == "Flood"
    assert incident["sender"] == "UNIT-2"
    assert incident["barangay"] == "Halapitan"
    assert incident["coordinates"] == "7.9186, 125.3286"
    assert incident["hasImage"] is True
    assert incident["dataSource"] == "database"


def test_list_messages_maps_incoming_report_fields(operations_client) -> None:
    client, db, _ = operations_client
    received_at = datetime(2026, 11, 16, 10, 30, tzinfo=timezone.utc)
    incident_report = SimpleNamespace(
        report_code="SF-2026-002",
        incident_type=SimpleNamespace(name="Fire"),
        barangay=SimpleNamespace(name="Kawayan"),
        location_description="Residential area",
        details="Smoke reported.",
    )
    message = SimpleNamespace(
        id=uuid4(),
        sender_responder=SimpleNamespace(call_sign="UNIT-3"),
        sender_operator=None,
        incident_report=incident_report,
        direction="incoming",
        body="Fire reported.",
        sent_at=None,
        received_at=received_at,
        created_at=received_at,
        transmission_status="received",
    )
    db.execute.return_value.all.return_value = [(message, 7.8998, 125.392)]

    response = client.get("/api/operations/messages")

    assert response.status_code == 200
    result = response.json()[0]
    assert result["sender"] == "UNIT-3"
    assert result["isOutgoing"] is False
    assert result["incidentReport"]["code"] == "SF-2026-002"
    assert result["incidentReport"]["coordinates"] == "7.8998, 125.3920"
    assert result["dataSource"] == "database"


def test_list_messages_includes_radio_status_and_attempt_history(operations_client) -> None:
    client, db, operator = operations_client
    attempted_at = datetime(2026, 11, 16, 10, 29, tzinfo=timezone.utc)
    message = SimpleNamespace(
        id=uuid4(),
        sender_responder=None,
        sender_operator=operator,
        incident_report=None,
        direction="outgoing",
        body="Check in",
        sent_at=None,
        received_at=None,
        created_at=attempted_at,
        transmission_status="sending",
        decoded_payload={"radio_lab": {"version": 1, "stage": "sending", "kind": "text"}},
        media_attachments=[],
        transmission_attempts=[
            SimpleNamespace(
                attempt_number=1,
                status="sending",
                attempted_at=attempted_at,
                result_details="Audio output started.",
            )
        ],
    )
    db.execute.return_value.all.return_value = [(message, None, None)]

    response = client.get("/api/operations/messages")

    assert response.status_code == 200
    result = response.json()[0]
    assert result["status"] == "sending"
    assert result["radioBacked"] is True
    assert result["attempts"] == [{
        "attemptNumber": 1,
        "status": "sending",
        "attemptedAt": attempted_at.isoformat().replace("+00:00", "Z"),
        "resultDetails": "Audio output started.",
    }]


def test_queue_message_uses_radio_queue_without_claiming_delivery(
    operations_client,
) -> None:
    client, db, operator = operations_client

    response = client.post(
        "/api/operations/messages",
        json={"content": "  Acknowledge receipt.  "},
    )

    assert response.status_code == 201
    result = response.json()
    assert result["sender"] == operator.username
    assert result["content"] == "Acknowledge receipt."
    assert result["status"] == "queued"
    assert result["radioBacked"] is True
    assert "not transmitted" in result["statusDetail"].lower()
    assert result["isOutgoing"] is True
    assert db.add.call_args.args[0].transmission_status == "queued"
    db.commit.assert_called_once()


def test_queue_message_rejects_blank_content(operations_client) -> None:
    client, db, _ = operations_client

    response = client.post("/api/operations/messages", json={"content": "  "})

    assert response.status_code == 422
    db.add.assert_not_called()
    db.commit.assert_not_called()
