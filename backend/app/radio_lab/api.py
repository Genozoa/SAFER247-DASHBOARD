"""Authenticated radio endpoints; audio work runs in the independent worker."""
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.api import CurrentPrincipal, CurrentSender, CurrentRadioViewer
from app.db.models import MediaAttachment, Message
from app.db.session import get_db_session
from app.radio_lab.aprs.codec import APRSError, build_position, build_text
from app.radio_lab.repository import RadioRepository, radio_filter
from app.radio_lab.schemas import TransmissionRequest
from app.radio_lab.settings import RadioSettings

router = APIRouter(prefix="/api/radio", tags=["radio"])
DBSession = Annotated[Session, Depends(get_db_session)]


def get_radio_settings():
    try:
        return RadioSettings.from_env()
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=503, detail=f"Invalid radio configuration: {error}") from error


Settings = Annotated[RadioSettings, Depends(get_radio_settings)]


def require_enabled(settings):
    if not settings.enabled:
        raise HTTPException(status_code=503, detail="Radio processing is disabled. Configure RADIO_ENABLED and start the radio worker.")


def validate_packet(payload, settings):
    try:
        build_text(settings.station, "Station validation")
    except APRSError as error:
        raise HTTPException(status_code=503, detail=f"Invalid RADIO_STATION: {error}") from error
    try:
        if payload.kind == "text":
            build_text(settings.station, payload.text, payload.addressee)
        else:
            build_position(settings.station, payload.latitude, payload.longitude, payload.text or "")
    except APRSError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/status")
def status(_: CurrentRadioViewer, settings: Settings, request: Request):
    supervisor = getattr(request.app.state, "radio_worker_supervisor", None)
    worker = supervisor.status() if supervisor is not None else {
        "state": "not-managed",
        "running": False,
        "error": None,
        "input_device": None,
        "output_device": None,
        "input_state": "unknown",
        "output_state": "unknown",
    }
    kiss = settings.aprs_transport == "kiss"
    kiss_connected = worker.get("kiss_state") == "connected"
    return {"enabled": settings.enabled, "station": settings.station,
            "backend": "direwolf-tcp-kiss+wav-spool" if kiss else "audio-device+wav-spool",
            "aprs_transport": settings.aprs_transport,
            "worker": worker,
            "hardware_verified": False, "android_verified": False,
            "audio_output_configured": bool(
                settings.output_enabled and (
                    kiss_connected if kiss
                    else settings.output_command or worker.get("output_device")
                )
            ),
            "continuous_input_configured": bool(
                kiss_connected if kiss else settings.input_enabled
                and (settings.input_command or worker.get("input_device"))
            ),
            "delivery": ("kiss-tnc" if settings.output_enabled else "disabled") if kiss
            else "audio-output" if settings.output_enabled and (
                settings.output_command or worker.get("output_device")
            ) else "wav-file"}


@router.get("/messages")
def messages(_: CurrentRadioViewer, db: DBSession, settings: Settings,
             limit: Annotated[int, Query(ge=1, le=200)] = 200):
    return RadioRepository(None, settings).list_messages(db, limit)


@router.post("/transmissions", status_code=202)
def transmit(payload: TransmissionRequest, principal: CurrentSender, db: DBSession, settings: Settings):
    validate_packet(payload, settings)
    repository = RadioRepository(None, settings)
    message = repository.enqueue(db, principal.operator.id, payload)
    return repository.view(message, settings)


@router.post("/transmissions/{identifier}/retry", status_code=202)
def retry(identifier: UUID, _: CurrentSender, db: DBSession, settings: Settings):
    require_enabled(settings)
    repository = RadioRepository(None, settings)
    try:
        message = repository.retry(db, identifier)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return repository.view(repository.get_message(db, message.id), settings)


@router.post("/transmissions/{identifier}/cancel", status_code=202)
def cancel(identifier: UUID, _: CurrentSender, db: DBSession, settings: Settings):
    repository = RadioRepository(None, settings)
    try:
        message = repository.cancel(db, identifier)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return repository.view(repository.get_message(db, message.id), settings)


@router.get("/media/{identifier}")
def media(identifier: UUID, _: CurrentRadioViewer, db: DBSession, settings: Settings,
          variant: Literal["original", "enhanced"] = "original"):
    attachment = db.scalar(select(MediaAttachment).join(Message).where(
        MediaAttachment.id == identifier, radio_filter(),
    ).options(selectinload(MediaAttachment.enhancements)))
    if attachment is None:
        raise HTTPException(status_code=404, detail="Radio image was not found.")
    path = attachment.storage_path
    if variant == "enhanced":
        if not attachment.enhancements:
            raise HTTPException(status_code=404, detail="Enhanced image was not found.")
        enhancement = max(attachment.enhancements, key=lambda item: item.enhanced_at)
        path = enhancement.enhanced_storage_path
    resolved = Path(path).resolve()
    if not resolved.is_relative_to(Path(settings.storage_dir).resolve()) or not resolved.is_file():
        raise HTTPException(status_code=404, detail="Radio image was not found.")
    return FileResponse(resolved, media_type="image/png" if variant == "enhanced" else attachment.mime_type,
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
