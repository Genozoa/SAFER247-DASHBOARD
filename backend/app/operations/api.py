from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2 import Geometry
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import cast, func, literal, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.api import CurrentPrincipal, CurrentSender
from app.db.models import (
    Barangay,
    IncidentReport,
    IncidentType,
    MediaAttachment,
    Message,
    Operator,
    Responder,
)
from app.db.session import get_db_session
from app.radio_lab.api import get_radio_settings
from app.radio_lab.aprs.codec import APRSError, build_text
from app.radio_lab.repository import RadioRepository
from app.radio_lab.schemas import TransmissionRequest
from app.radio_lab.settings import RadioSettings

router = APIRouter(prefix="/api/operations", tags=["operations"])
DBSession = Annotated[Session, Depends(get_db_session)]
RadioSettingsDependency = Annotated[RadioSettings, Depends(get_radio_settings)]


class IncidentView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    report_code: str = Field(alias="reportCode")
    type: str
    sender: str | None
    barangay: str | None
    location: str | None
    lat: float | None
    lng: float | None
    coordinates: str
    date: datetime
    time: str
    text: str | None
    status: str
    has_image: bool = Field(alias="hasImage")
    data_source: str = Field(alias="dataSource")


class MessageIncidentView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    type: str | None
    location: str | None
    coordinates: str
    details: str | None


class MessageAttemptView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    attempt_number: int = Field(alias="attemptNumber")
    status: str
    attempted_at: datetime = Field(alias="attemptedAt")
    result_details: str | None = Field(alias="resultDetails")


class MessageView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    sender: str | None
    is_outgoing: bool = Field(alias="isOutgoing")
    type: str | None
    incident_report: MessageIncidentView | None = Field(alias="incidentReport")
    content: str
    sent_at: datetime = Field(alias="sentAt")
    status: str
    status_detail: str | None = Field(default=None, alias="statusDetail")
    attempts: list[MessageAttemptView] = Field(default_factory=list)
    radio_backed: bool = Field(default=False, alias="radioBacked")
    image: dict | None = None
    data_source: str = Field(alias="dataSource")


class QueuedMessageRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message content is required.")
        return normalized


def _point_coordinates(db: Session, column):
    if db.get_bind().dialect.name != "postgresql":
        return literal(None), literal(None)
    point = cast(column, Geometry("POINT", srid=4326))
    return func.ST_Y(point), func.ST_X(point)


def _coordinate_text(latitude: float | None, longitude: float | None) -> str:
    if latitude is None or longitude is None:
        return "Location unavailable"
    return f"{latitude:.4f}, {longitude:.4f}"


def _incident_rows(db: Session):
    latitude, longitude = _point_coordinates(db, IncidentReport.location)
    statement = (
        select(
            IncidentReport,
            IncidentType.name,
            Responder.call_sign,
            Barangay.name,
            latitude,
            longitude,
        )
        .outerjoin(IncidentType, IncidentReport.incident_type_id == IncidentType.id)
        .outerjoin(Responder, IncidentReport.responder_id == Responder.id)
        .outerjoin(Barangay, IncidentReport.barangay_id == Barangay.id)
        .options(selectinload(IncidentReport.media_attachments))
        .order_by(IncidentReport.reported_at.desc(), IncidentReport.id)
    )
    return db.execute(statement).all()


def _incident_view(row) -> IncidentView:
    report, incident_type, sender, barangay, latitude, longitude = row
    return IncidentView(
        id=str(report.id),
        report_code=report.report_code,
        type=incident_type or "Uncategorized",
        sender=sender,
        barangay=barangay,
        location=report.location_description,
        lat=latitude,
        lng=longitude,
        coordinates=_coordinate_text(latitude, longitude),
        date=report.reported_at,
        time=report.reported_at.strftime("%I:%M %p"),
        text=report.details,
        status=report.status,
        has_image=bool(report.media_attachments),
        data_source="database",
    )


def _message_rows(db: Session):
    latitude, longitude = _point_coordinates(db, IncidentReport.location)
    statement = (
        select(Message, latitude, longitude)
        .outerjoin(IncidentReport, Message.id == IncidentReport.source_message_id)
        .options(
            joinedload(Message.sender_responder),
            joinedload(Message.sender_operator),
            selectinload(Message.transmission_attempts),
            selectinload(Message.media_attachments).selectinload(
                MediaAttachment.enhancements
            ),
            joinedload(Message.incident_report).joinedload(
                IncidentReport.incident_type
            ),
            joinedload(Message.incident_report).joinedload(IncidentReport.barangay),
        )
        .order_by(
            func.coalesce(
                Message.sent_at,
                Message.received_at,
                Message.created_at,
            ),
            Message.id,
        )
    )
    return db.execute(statement).all()


def _message_view(row) -> MessageView:
    message, latitude, longitude = row
    incident_report = message.incident_report
    sender = (
        message.sender_responder.call_sign
        if message.sender_responder is not None
        else message.sender_operator.username
        if message.sender_operator is not None
        else None
    )
    incident = None
    incident_type = None
    if incident_report is not None:
        incident_type = (
            incident_report.incident_type.name
            if incident_report.incident_type is not None
            else None
        )
        barangay = (
            incident_report.barangay.name
            if incident_report.barangay is not None
            else None
        )
        location = incident_report.location_description
        if barangay:
            location = f"{location}, {barangay}" if location else barangay
        incident = MessageIncidentView(
            code=incident_report.report_code,
            type=incident_type,
            location=location,
            coordinates=_coordinate_text(latitude, longitude),
            details=incident_report.details,
        )

    radio_view = RadioRepository.view(message)
    is_radio_backed = radio_view["radio_backed"]
    status = radio_view["status"] if is_radio_backed else message.transmission_status
    status_detail = radio_view["status_detail"] if is_radio_backed else None
    if not is_radio_backed and message.direction == "outgoing":
        if message.transmission_status == "sent":
            status = "delivery_unknown"
            status_detail = "Legacy status cannot verify receiver delivery."
        elif message.transmission_status == "queued":
            status_detail = "Queued by the backend; not transmitted."
    attempts = radio_view["attempts"] if is_radio_backed else [
        {
            "attempt_number": item.attempt_number,
            "status": {
                "transmitting": "delivery_unknown",
                "sent": "audio_complete",
            }.get(item.status, item.status),
            "attempted_at": item.attempted_at,
            "result_details": item.result_details,
        }
        for item in sorted(
            getattr(message, "transmission_attempts", []) or [],
            key=lambda item: item.attempt_number,
        )
    ]

    return MessageView(
        id=str(message.id),
        sender=sender,
        is_outgoing=message.direction == "outgoing",
        type=incident_type,
        incident_report=incident,
        content=message.body or "",
        sent_at=message.sent_at or message.received_at or message.created_at,
        status=status,
        status_detail=status_detail,
        attempts=attempts,
        radio_backed=is_radio_backed,
        image=(
            {"filename": "PD90 image", "originalUrl": radio_view["original_url"], "enhancedUrl": radio_view["enhanced_url"]}
            if radio_view["original_url"] else None
        ),
        data_source="database",
    )


@router.get("/incidents", response_model=list[IncidentView])
def list_incidents(
    _: CurrentPrincipal,
    db: DBSession,
) -> list[IncidentView]:
    return [_incident_view(row) for row in _incident_rows(db)]


@router.get("/messages", response_model=list[MessageView])
def list_messages(
    _: CurrentPrincipal,
    db: DBSession,
) -> list[MessageView]:
    return [_message_view(row) for row in _message_rows(db)]


@router.post("/messages", response_model=MessageView, status_code=201)
def queue_message(
    payload: QueuedMessageRequest,
    principal: CurrentSender,
    db: DBSession,
    settings: RadioSettingsDependency,
) -> MessageView:
    operator: Operator = principal.operator
    request = TransmissionRequest(kind="text", text=payload.content)
    try:
        build_text(settings.station, payload.content, "ALL")
    except APRSError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    message = RadioRepository(None, settings).enqueue(db, operator.id, request)
    if not settings.enabled:
        status_detail = "Radio processing is disabled; queued by the backend and not transmitted."
    elif not settings.output_command:
        status_detail = "Queued by the backend; no audio output is configured, so it has not been transmitted."
    else:
        status_detail = "Queued by the backend, waiting for the radio worker; not transmitted."
    return MessageView(
        id=str(message.id),
        sender=operator.username,
        is_outgoing=True,
        type=None,
        incident_report=None,
        content=message.body or "",
        sent_at=message.created_at,
        status=message.transmission_status,
        status_detail=status_detail,
        attempts=[],
        radio_backed=True,
        data_source="database",
    )
