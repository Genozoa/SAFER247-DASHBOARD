"""Durable radio IPC on the project's existing PostgreSQL tables.

The worker owns RF processing. HTTP requests only validate transport payloads and
commit queue rows; encoded WAV artifacts are never presented as RF delivery.
"""
from __future__ import annotations

import math
import shutil
import json
import re
import base64
import binascii
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import (
    ImageEnhancement, IncidentReport, IncidentType, MediaAttachment, Message, MessageTransmissionAttempt,
    Responder, ResponderLocation,
)
from app.radio_lab.schemas import TransmissionRequest


def now():
    return datetime.now(timezone.utc)


def radio_data(message):
    return dict((getattr(message, "decoded_payload", None) or {}).get("radio_lab", {}))


def set_radio_data(message, values):
    message.decoded_payload = {**(message.decoded_payload or {}), "radio_lab": values}


def radio_filter():
    return Message.decoded_payload["radio_lab"]["version"].as_integer() == 1


def point(latitude, longitude):
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


def image_mode(data):
    """Read recorded image mode without assigning a mode to historical records."""
    if data.get("kind") != "image":
        return None
    raw = data.get("raw")
    return data.get("mode") or (raw.get("mode") if isinstance(raw, dict) else None)


class RadioRepository:
    def __init__(self, session_factory, settings):
        self.session_factory = session_factory
        self.settings = settings

    def enqueue(self, db, operator_id, payload):
        request = payload if isinstance(payload, TransmissionRequest) else TransmissionRequest.model_validate(payload)
        data = request.model_dump(exclude_none=True)
        data.update(version=1, stage="queued", station=self.settings.station)
        identifier = uuid4()
        message = Message(id=identifier, direction="outgoing", sender_operator_id=operator_id,
                          body=request.text or "APRS position",
                          decoded_payload={"radio_lab": data}, transmission_status="queued", created_at=now(),
                          transmission_attempts=[])
        if request.kind == "position":
            message.location = point(request.latitude, request.longitude)
        try:
            db.add(message)
            db.commit()
        except Exception:
            db.rollback()
            raise
        return message

    def claim_next(self):
        """PostgreSQL row locks claim a single pending job across DB clients."""
        with self.session_factory.begin() as db:
            pending = db.scalars(select(Message).where(
                radio_filter(), Message.direction == "outgoing", Message.transmission_status == "queued",
                Message.decoded_payload["radio_lab"]["stage"].as_string() == "queued",
            ).order_by(Message.created_at, Message.id).with_for_update(skip_locked=True)).all()
            message = None
            compound_ids = []
            for candidate in pending:
                compound_id = radio_data(candidate).get("compound_id")
                if compound_id and compound_id not in compound_ids:
                    compound_ids.append(compound_id)
            if compound_ids:
                # Legacy incident groups are claimed in sequence so a failed
                # member can cancel the remaining historical records.
                compound_id = compound_ids[0]
                rows = db.scalars(select(Message).where(
                    radio_filter(), Message.direction == "outgoing",
                    Message.decoded_payload["radio_lab"]["compound_id"].as_string() == compound_id,
                ).order_by(Message.decoded_payload["radio_lab"]["compound_sequence"].as_integer(),
                           Message.created_at).with_for_update(skip_locked=True)).all()
                for candidate in rows:
                    data = radio_data(candidate)
                    if candidate.transmission_status in {"failed", "delivery_unknown", "canceled"}:
                        for blocked in rows:
                            if blocked.transmission_status == "queued":
                                blocked_data = radio_data(blocked)
                                blocked_data.update(stage="canceled", error="Compound transaction canceled after metadata failure.")
                                set_radio_data(blocked, blocked_data)
                                blocked.transmission_status = "canceled"
                        break
                    if candidate.transmission_status == "queued" and data.get("stage") == "queued":
                        message = candidate
                        break
                    if candidate.transmission_status not in {"queued", "audio_complete"}:
                        break
            else:
                message = pending[0] if pending else None
            if message is None:
                return None
            data = radio_data(message)
            data.update(stage="preparing", error=None)
            set_radio_data(message, data)
            message.transmission_status = "preparing"
            attempts = db.scalars(select(MessageTransmissionAttempt).where(
                MessageTransmissionAttempt.message_id == message.id)).all()
            number = max((attempt.attempt_number for attempt in attempts), default=0) + 1
            db.add(MessageTransmissionAttempt(message_id=message.id, attempt_number=number,
                                             status="preparing", attempted_at=now(),
                                             result_details="Worker claimed the message; preparing audio."))
            return {**data, "id": str(message.id)}

    @staticmethod
    def _update_attempt(db, identifier, status, detail):
        attempt = db.scalar(select(MessageTransmissionAttempt).where(
            MessageTransmissionAttempt.message_id == identifier,
        ).order_by(MessageTransmissionAttempt.attempt_number.desc()).limit(1))
        if attempt is not None:
            attempt.status = status
            attempt.result_details = detail

    def mark_sending(self, identifier):
        with self.session_factory.begin() as db:
            message = db.get(Message, UUID(str(identifier)), with_for_update=True)
            if message is None or message.transmission_status != "preparing":
                raise ValueError("Radio job is no longer preparing.")
            data = radio_data(message)
            data.update(stage="sending", error=None)
            set_radio_data(message, data)
            message.transmission_status = "sending"
            self._update_attempt(
                db,
                message.id,
                "sending",
                "Configured audio output started; receiver delivery is unconfirmed.",
            )

    def finish(self, identifier, result):
        with self.session_factory.begin() as db:
            message = db.get(Message, UUID(str(identifier)), with_for_update=True)
            if message is None or message.transmission_status not in {"preparing", "sending"}:
                raise ValueError("Radio job is no longer transmitting.")
            audio_complete = result.get("audio_complete") is True
            kiss_accepted = result.get("kiss_accepted") is True
            status = "delivery_unknown" if kiss_accepted else "audio_complete" if audio_complete else "queued"
            stage = "tnc_queued" if kiss_accepted else status if status != "queued" else "encoded"
            data = radio_data(message)
            data.update(stage=stage, delivery=result.get("delivery", "wav-file"),
                        audio_path=str(result.get("audio_path", "")), error=None)
            set_radio_data(message, data)
            message.transmission_status = status
            if audio_complete:
                message.sent_at = now()
            if kiss_accepted:
                detail = "Frame submitted to Dire Wolf via TCP KISS; RF delivery is unconfirmed. No automatic retry."
            elif audio_complete:
                detail = "Audio output completed; receiver delivery is unconfirmed."
            else:
                detail = "WAV file created; no audio output or radio transmission occurred."
            self._update_attempt(db, message.id, status, detail)

    def fail(self, identifier, error):
        with self.session_factory.begin() as db:
            message = db.get(Message, UUID(str(identifier)), with_for_update=True)
            if message is None:
                return
            status = (
                "delivery_unknown"
                if message.transmission_status in {"sending", "transmitting"}
                else "failed"
            )
            data = radio_data(message)
            data.update(stage=status, error=str(error)[:1024])
            set_radio_data(message, data)
            message.transmission_status = status
            self._update_attempt(db, message.id, status, str(error)[:1024])
            compound_id = data.get("compound_id")
            if compound_id:
                rows = db.scalars(select(Message).where(
                    radio_filter(),
                    Message.direction == "outgoing",
                    Message.decoded_payload["radio_lab"]["compound_id"].as_string() == compound_id,
                    Message.id != message.id,
                ).with_for_update()).all()
                for row in rows:
                    if row.transmission_status in {"queued", "preparing", "sending"}:
                        row_data = radio_data(row)
                        row_data.update(stage="canceled", error="Compound transaction canceled after metadata or earlier output failed.")
                        set_radio_data(row, row_data)
                        row.transmission_status = "canceled"
                        self._update_attempt(db, row.id, "canceled", "Canceled because the compound transaction failed earlier.")

    def recover_interrupted(self):
        """Called after obtaining the worker lock; never automatically replay audio."""
        with self.session_factory.begin() as db:
            messages = db.scalars(select(Message).where(
                radio_filter(), Message.direction == "outgoing",
                Message.transmission_status.in_(("preparing", "sending", "transmitting")),
            ).with_for_update()).all()
            for message in messages:
                status = (
                    "delivery_unknown"
                    if message.transmission_status in {"sending", "transmitting"}
                    else "failed"
                )
                error = (
                    "Worker stopped after audio output may have begun; delivery is unknown. "
                    "Retry requires operator action."
                    if status == "delivery_unknown"
                    else "Worker stopped before audio output began."
                )
                data = radio_data(message)
                data.update(stage=status, error=error)
                set_radio_data(message, data)
                message.transmission_status = status
                self._update_attempt(db, message.id, status, error)
                compound_id = data.get("compound_id")
                if compound_id:
                    rows = db.scalars(select(Message).where(
                        radio_filter(),
                        Message.direction == "outgoing",
                        Message.decoded_payload["radio_lab"]["compound_id"].as_string() == compound_id,
                        Message.id != message.id,
                    ).with_for_update()).all()
                    for row in rows:
                        if row.transmission_status == "queued":
                            row_data = radio_data(row)
                            row_data.update(stage="canceled", error="Compound transaction canceled after worker interruption.")
                            set_radio_data(row, row_data)
                            row.transmission_status = "canceled"
                            self._update_attempt(db, row.id, "canceled", "Canceled after compound worker interruption.")
            return len(messages)

    def retry(self, db, identifier):
        message = db.scalar(select(Message).where(Message.id == identifier, radio_filter()).with_for_update())
        if message is None:
            raise LookupError("Radio transmission was not found.")
        if message.direction != "outgoing" or message.transmission_status not in {
            "failed", "delivery_unknown"
        }:
            raise ValueError("Only failed or uncertain outgoing transmissions can be retried.")
        data = radio_data(message)
        if data.get("kind") not in {"text", "position"}:
            raise ValueError("Only APRS text or position transmissions can be retried.")
        data.update(stage="queued", error=None)
        set_radio_data(message, data)
        message.transmission_status = "queued"
        db.commit()
        return message

    def cancel(self, db, identifier):
        message = db.scalar(select(Message).where(Message.id == identifier, radio_filter()).with_for_update())
        if message is None:
            raise LookupError("Radio transmission was not found.")
        if message.direction != "outgoing" or message.transmission_status not in {
            "queued", "preparing", "sending"
        }:
            raise ValueError("Only queued or active outgoing transmissions can be canceled.")
        compound_id = radio_data(message).get("compound_id")
        if compound_id:
            rows = db.scalars(select(Message).where(
                radio_filter(),
                Message.direction == "outgoing",
                Message.decoded_payload["radio_lab"]["compound_id"].as_string() == compound_id,
            ).with_for_update()).all()
            for row in rows:
                if row.transmission_status in {"queued", "preparing", "sending"}:
                    data = radio_data(row)
                    data.update(stage="canceled", error="Compound transmission canceled by operator.")
                    set_radio_data(row, data)
                    row.transmission_status = "canceled"
                    self._update_attempt(db, row.id, "canceled", "Compound transmission canceled by operator.")
        else:
            data = radio_data(message)
            data.update(stage="canceled", error="Canceled by operator.")
            set_radio_data(message, data)
            message.transmission_status = "canceled"
            self._update_attempt(db, message.id, "canceled", "Canceled by operator.")
        db.commit()
        return message

    def _copy_media(self, source, folder, identifier):
        source = Path(source).resolve()
        destination_folder = Path(self.settings.storage_dir).resolve() / folder
        destination_folder.mkdir(parents=True, exist_ok=True)
        destination = destination_folder / f"{identifier}.png"
        if source != destination:
            # Exclusive creation protects immutable originals from accidental replacement.
            with source.open("rb") as incoming, destination.open("xb") as outgoing:
                shutil.copyfileobj(incoming, outgoing)
        return str(destination)

    def _persist_incident_fragment(self, db, station, responder, fragment, source_message):
        """Reassemble complete S247 envelope; incomplete fragments remain durable."""
        from app.radio_lab.aprs.codec import parse_incident_fragment

        if fragment is None:
            return
        parsed = fragment if isinstance(fragment, dict) else parse_incident_fragment(fragment)
        if not parsed:
            return
        state = {**parsed, "station": station}
        data = radio_data(source_message)
        data["incident_fragment"] = state
        set_radio_data(source_message, data)

        candidates = db.scalars(select(Message).where(
            radio_filter(),
            Message.direction == "incoming",
            Message.decoded_payload["radio_lab"]["kind"].as_string() == "text",
        ).order_by(Message.received_at.desc())).all()
        pieces = {}
        for message in candidates:
            other = radio_data(message).get("incident_fragment")
            if not isinstance(other, dict):
                continue
            if other.get("prefix") != parsed["prefix"] or other.get("station") != station:
                continue
            pieces[other["index"]] = other["encoded"]
        if len(pieces) != parsed["total"] or any(index not in pieces for index in range(1, parsed["total"] + 1)):
            return
        try:
            encoded = "".join(pieces[index] for index in range(1, parsed["total"] + 1))
            padded = encoded + "=" * ((4 - len(encoded) % 4) % 4)
            envelope = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        except (binascii.Error, json.JSONDecodeError, UnicodeDecodeError, ValueError):
            data["incident_fragment_error"] = "Incomplete or invalid incident metadata envelope."
            set_radio_data(source_message, data)
            return
        if envelope.get("version") != 1:
            data["incident_fragment_error"] = "Unsupported incident metadata envelope."
            set_radio_data(source_message, data)
            return
        report_id = envelope.get("report_id")
        if not isinstance(report_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", report_id):
            data["incident_fragment_error"] = "Invalid incident report ID."
            set_radio_data(source_message, data)
            return

        existing = db.scalar(select(IncidentReport).where(IncidentReport.report_code == report_id))
        if existing is not None:
            envelope_data = radio_data(source_message)
            envelope_data["incident_envelope"] = envelope
            set_radio_data(source_message, envelope_data)
            return
        incident_type = db.scalar(select(IncidentType).where(
            IncidentType.name == str(envelope.get("incident_type", "Uncategorized"))
        ))
        if incident_type is None:
            incident_type = IncidentType(name=str(envelope.get("incident_type", "Uncategorized"))[:64], is_active=True)
            db.add(incident_type)
            db.flush()
        photo = envelope.get("photo_location") if isinstance(envelope.get("photo_location"), dict) else {}
        latitude = photo.get("latitude") if photo.get("available") is True else None
        longitude = photo.get("longitude") if photo.get("available") is True else None
        try:
            timestamp = datetime.fromisoformat(str(envelope.get("timestamp")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            timestamp = now()
        report = IncidentReport(
            report_code=report_id,
            source_message_id=source_message.id,
            incident_type_id=incident_type.id,
            responder_id=responder.id,
            location=point(latitude, longitude) if latitude is not None and longitude is not None else None,
            details=str(envelope.get("description", ""))[:512],
            status="pending_image",
            reported_at=timestamp,
        )
        db.add(report)
        envelope_data = radio_data(source_message)
        envelope_data["incident_envelope"] = envelope
        envelope_data["incident_report_id"] = report_id
        set_radio_data(source_message, envelope_data)
        db.flush()

    def receive(self, result):
        """Persist only successfully decoded content, without inventing incident metadata."""
        kind = result["kind"]
        if kind not in {"text", "position", "image"}:
            raise ValueError("Unsupported decoded radio content.")
        station = result.get("station") or result.get("source") or "SSTV-UNKNOWN"
        data = {"version": 1, "stage": "received", "kind": kind, "station": station,
                "text": result.get("text", ""), "raw": result.get("raw")}
        if kind == "image":
            data["mode"] = image_mode(data)
        receipt_id = result.get("receipt_id")
        if receipt_id is not None:
            if not isinstance(receipt_id, str) or not 1 <= len(receipt_id) <= 128:
                raise ValueError("Receipt identity must contain 1–128 characters.")
            data["receipt_id"] = receipt_id
        identifier = uuid4()
        if kind == "position":
            latitude, longitude = float(result["latitude"]), float(result["longitude"])
            if not (math.isfinite(latitude) and math.isfinite(longitude)
                    and -90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError("Decoded position is outside geographic bounds.")
            data.update(latitude=latitude, longitude=longitude)
        if kind == "text":
            from app.radio_lab.aprs.codec import parse_incident_fragment
            fragment = parse_incident_fragment(result.get("text", ""))
            if fragment is not None:
                fragment["station"] = station
                data["incident_fragment"] = fragment
        with self.session_factory.begin() as db:
            if receipt_id:
                # The worker singleton serializes receipts. This allows replaying a
                # partially committed WAV batch without duplicating earlier rows.
                existing = db.scalar(select(Message.id).where(
                    radio_filter(), Message.direction == "incoming",
                    Message.decoded_payload["radio_lab"]["receipt_id"].as_string() == receipt_id,
                ).limit(1))
                if existing is not None:
                    return str(existing)
            responder = db.scalar(select(Responder).where(Responder.call_sign == station))
            if responder is None:
                responder = Responder(id=uuid4(), call_sign=station, is_active=True, created_at=now())
                db.add(responder)
                db.flush()
            message = Message(id=identifier, direction="incoming", sender_responder_id=responder.id,
                              body=data["text"] or (
                                  f"{data['mode']} image (sender unidentified)" if kind == "image" and data["mode"]
                                  else "SSTV image (mode unknown; sender unidentified)" if kind == "image"
                                  else "APRS position"),
                              decoded_payload={"radio_lab": data}, transmission_status="received",
                              received_at=now(), created_at=now())
            if kind == "position":
                message.location = point(data["latitude"], data["longitude"])
            db.add(message)
            db.flush()
            if kind == "text" and data.get("incident_fragment"):
                self._persist_incident_fragment(db, station, responder, data["incident_fragment"], message)
            if kind == "position":
                db.add(ResponderLocation(responder_id=responder.id, received_message_id=identifier,
                                         location=point(data["latitude"], data["longitude"]), recorded_at=now(), received_at=now()))
            if kind == "image":
                attachment_id = uuid4()
                original = self._copy_media(result["original_path"], "originals", attachment_id)
                attachment = MediaAttachment(id=attachment_id, message_id=identifier,
                                             file_name=Path(original).name, storage_path=original,
                                             mime_type="image/png", received_at=now())
                db.add(attachment)
                db.flush()
                if result.get("enhanced_path"):
                    enhanced = self._copy_media(result["enhanced_path"], "enhanced", attachment_id)
                    db.add(ImageEnhancement(id=uuid4(), attachment_id=attachment_id,
                                            enhanced_storage_path=enhanced,
                                            enhancement_parameters=result.get("enhancement_parameters", {"method": "classical"}),
                                            enhanced_at=now()))
                    db.flush()
                # SSTV carries no trustworthy sender or report ID. Leave unattached until explicitly reviewed.
        return str(identifier)

    @staticmethod
    def view(message, settings=None):
        data = radio_data(message)
        attachments = getattr(message, "media_attachments", []) or []
        attachment = attachments[0] if attachments else None
        enhancements = attachment.enhancements if attachment else []
        media_url = f"/api/radio/media/{attachment.id}" if attachment else None
        stage = data.get("stage")
        status = {
            "encoded": "queued",
            "transmitting": "delivery_unknown",
            "sent": "audio_complete",
            "failed": (
                "delivery_unknown"
                if "delivery unknown" in str(data.get("error", "")).lower()
                else "failed"
            ),
        }.get(stage, message.transmission_status)
        if status == "transmitting":
            status = "delivery_unknown"
        elif status == "sent":
            status = "audio_complete"
        attempts = [
            {
                "attempt_number": attempt.attempt_number,
                "status": {
                    "transmitting": "delivery_unknown",
                    "sent": "audio_complete",
                }.get(attempt.status, attempt.status),
                "attempted_at": attempt.attempted_at,
                "result_details": attempt.result_details,
            }
            for attempt in sorted(
                getattr(message, "transmission_attempts", []) or [],
                key=lambda attempt: attempt.attempt_number,
            )
        ]
        latest_detail = attempts[-1]["result_details"] if attempts else None
        if stage == "tnc_queued" and status == "delivery_unknown":
            status_detail = latest_detail or "Frame submitted to Dire Wolf; RF delivery is unconfirmed."
        elif data.get("error") and status == "delivery_unknown":
            status_detail = f"Delivery is unknown; no automatic retry was made. {data['error']}"
        elif data.get("error"):
            status_detail = data["error"]
        elif status == "queued" and stage == "encoded":
            status_detail = "WAV file created; no audio output is configured, so it was not transmitted."
        elif status == "queued" and settings is not None and not settings.enabled:
            status_detail = "Radio processing is disabled; queued by the backend and not transmitted."
        elif status == "queued" and settings is not None and settings.aprs_transport == "kiss":
            status_detail = "Queued for TCP KISS; no RF transmission has been confirmed."
        elif status == "queued" and settings is not None and not settings.output_command:
            status_detail = "Queued by the backend; no audio output is configured, so it has not been transmitted."
        elif status == "queued":
            status_detail = "Queued by the backend, waiting for the radio worker; not transmitted."
        elif status == "preparing":
            status_detail = "The radio worker is preparing APRS data; output has not started."
        elif status == "sending":
            status_detail = "Configured audio output has started; receiver delivery is unconfirmed."
        elif status == "audio_complete":
            status_detail = "Audio output completed; receiver delivery is unconfirmed."
        elif status == "delivered":
            status_detail = "A valid delivery acknowledgement was received."
        elif status == "delivery_unknown" and (stage == "transmitting" or message.transmission_status == "transmitting"):
            status_detail = "Legacy worker state cannot show whether audio output started; delivery is unknown. No automatic retry was made."
        elif status == "failed":
            status_detail = latest_detail or "Processing failed before audio output started."
        elif status == "canceled":
            status_detail = latest_detail or data.get("error") or "Canceled by operator."
        elif status == "delivery_unknown":
            status_detail = latest_detail or "Audio output may have started; delivery is unknown."
        else:
            status_detail = latest_detail
        return {"id": str(message.id), "kind": data.get("kind"), "direction": message.direction,
                "mode": image_mode(data),
                "status": status, "status_detail": status_detail, "attempts": attempts,
                "text": data.get("text", message.body or ""), "station": data.get("station"),
                "latitude": data.get("latitude"), "longitude": data.get("longitude"),
                "report_id": data.get("report_id"),
                "compound_id": data.get("compound_id"),
                "incident_envelope": data.get("incident_envelope"),
                "created_at": message.created_at, "error": data.get("error"), "delivery": data.get("delivery"),
                "original_url": f"{media_url}?variant=original" if media_url else None,
                "enhanced_url": f"{media_url}?variant=enhanced" if media_url and enhancements else None,
                "radio_backed": bool(data.get("version") == 1)}

    @staticmethod
    def get_message(db, identifier):
        return db.scalar(select(Message).where(Message.id == identifier, radio_filter()).options(
            selectinload(Message.media_attachments).selectinload(MediaAttachment.enhancements),
            selectinload(Message.transmission_attempts)))

    def list_messages(self, db, limit=200):
        messages = db.scalars(select(Message).where(radio_filter()).options(
            selectinload(Message.media_attachments).selectinload(MediaAttachment.enhancements),
            selectinload(Message.transmission_attempts),
        ).order_by(Message.created_at.desc(), Message.id).limit(limit)).all()
        return [self.view(message, self.settings) for message in messages]
