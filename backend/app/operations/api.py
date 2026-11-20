from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import Geometry
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import cast, func, literal, or_, select
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
    ResponderLocation,
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


def _incident_rows(db: Session, owner_id, limit: int = 500, offset: int = 0):
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
        .where(IncidentReport.sample_owner_operator_id == owner_id if owner_id is not None
               else IncidentReport.sample_owner_operator_id.is_(None))
        .order_by(IncidentReport.reported_at.desc(), IncidentReport.id)
        .limit(limit).offset(offset)
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
        data_source="synthetic" if report.sample_owner_operator_id else "database",
    )


def _message_rows(db: Session, owner_id, limit: int = 500, offset: int = 0):
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
        .where(Message.sample_owner_operator_id == owner_id if owner_id is not None
               else Message.sample_owner_operator_id.is_(None))
        .order_by(
            func.coalesce(
                Message.sent_at,
                Message.received_at,
                Message.created_at,
            ).desc(),
            Message.id,
        ).limit(limit).offset(offset)
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
        data_source="synthetic" if message.sample_owner_operator_id else "database",
    )


@router.get("/incidents", response_model=list[IncidentView])
def list_incidents(
    principal: CurrentPrincipal,
    db: DBSession,
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[IncidentView]:
    return [_incident_view(row) for row in _incident_rows(db, principal.operator.id if principal.operator.username == "Demo" else None, limit, offset)]


@router.get("/messages", response_model=list[MessageView])
def list_messages(
    principal: CurrentPrincipal,
    db: DBSession,
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[MessageView]:
    return [_message_view(row) for row in _message_rows(db, principal.operator.id if principal.operator.username == "Demo" else None, limit, offset)]


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


class ImageCorrelationRequest(BaseModel):
    report_code: str = Field(min_length=8, max_length=64)
    confirm: bool
    verification_notes: str = Field(min_length=12, max_length=1000)


@router.post("/images/{attachment_id}/correlate", status_code=200)
def correlate_image(
    attachment_id: str,
    payload: ImageCorrelationRequest,
    principal: CurrentSender,
    db: DBSession,
):
    """Require explicit human verification; SSTV contains no inherent report identity."""
    from uuid import UUID
    try:
        attachment_uuid = UUID(attachment_id)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid attachment ID.") from error
    if payload.confirm is not True:
        raise HTTPException(status_code=422, detail="Explicit confirmation is required.")
    attachment = db.scalar(
        select(MediaAttachment).where(MediaAttachment.id == attachment_uuid).with_for_update()
    )
    report = db.scalar(
        select(IncidentReport).where(IncidentReport.report_code == payload.report_code).with_for_update()
    )
    if attachment is None or report is None:
        raise HTTPException(status_code=404, detail="Image or incident was not found.")
    if attachment.incident_report_id is not None:
        raise HTTPException(status_code=409, detail="This image is already linked to an incident.")
    if attachment.message_id is None:
        raise HTTPException(status_code=422, detail="Only received radio images are eligible.")
    received = db.get(Message, attachment.message_id)
    if received is None or received.direction != "incoming" or (
        (received.decoded_payload or {}).get("radio_lab", {}).get("kind") != "image"
    ):
        raise HTTPException(status_code=422, detail="Attachment is not a decoded SSTV image.")
    if report.status != "pending_image":
        raise HTTPException(status_code=409, detail="Report is not awaiting an image.")
    attachment.incident_report_id = report.id
    attachment.linked_by_operator_id = principal.operator.id
    attachment.linked_at = datetime.now(timezone.utc)
    report.status = "complete"
    report.updated_at = datetime.now(timezone.utc)
    # Notes are a human assertion, never proof of RF origin.
    radio = dict((received.decoded_payload or {}).get("radio_lab", {}))
    radio["manual_correlation"] = {
        "report_code": payload.report_code,
        "operator_id": str(principal.operator.id),
        "notes": payload.verification_notes,
        "verified_at": attachment.linked_at.isoformat(),
        "proof": "human_review_unverified_origin",
    }
    received.decoded_payload = {**(received.decoded_payload or {}), "radio_lab": radio}
    db.commit()
    return {"reportCode": report.report_code, "attachmentId": str(attachment.id),
            "linkedBy": str(principal.operator.id), "verification": "manual_review"}


class ResponderTrackView(BaseModel):
    id: str
    name: str
    unit: str
    lat: float
    lng: float
    lastSeen: datetime
    trail: list[list[float]]
    source: str = "unverified_aprs_radio"


@router.get("/responders/locations", response_model=list[ResponderTrackView])
def responder_locations(principal: CurrentPrincipal, db: DBSession) -> list[ResponderTrackView]:
    """Return recent radio-derived positions only; APRS does not authenticate sender identity."""
    if principal.operator.username == "Demo":
        return []
    latitude, longitude = _point_coordinates(db, ResponderLocation.location)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = db.execute(
        select(Responder, ResponderLocation, latitude, longitude)
        .join(ResponderLocation, ResponderLocation.responder_id == Responder.id)
        .where(Responder.is_active.is_(True), ResponderLocation.recorded_at >= cutoff)
        .order_by(ResponderLocation.recorded_at.desc(), ResponderLocation.id.desc())
        .limit(2000)
    ).all()
    tracks = {}
    for responder, position, lat, lng in rows:
        if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        key = str(responder.id)
        if key not in tracks:
            tracks[key] = {"id": key, "name": responder.display_name or responder.call_sign,
                           "unit": responder.call_sign, "lat": lat, "lng": lng,
                           "lastSeen": position.recorded_at, "trail": [],
                           "source": "unverified_aprs_radio"}
        if len(tracks[key]["trail"]) < 25:
            tracks[key]["trail"].append([lat, lng])
    for track in tracks.values():
        track["trail"].reverse()
    return [ResponderTrackView(**track) for track in tracks.values()]
