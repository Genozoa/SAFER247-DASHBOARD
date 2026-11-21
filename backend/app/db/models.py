from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from geoalchemy2 import Geography, Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime

from app.db.base import Base


class Operator(Base):
    __tablename__ = "operators"
    __table_args__ = (UniqueConstraint("username", name="uq_operators_username"),)

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    username: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    # Null only for existing accounts that have not yet verified the developer code.
    registration_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    sent_messages: Mapped[list["Message"]] = relationship(
        back_populates="sender_operator",
        foreign_keys="Message.sender_operator_id",
        passive_deletes="all",
    )
    image_enhancements: Mapped[list["ImageEnhancement"]] = relationship(
        back_populates="operator"
    )
    auth_sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="operator", cascade="all, delete-orphan"
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        Index("idx_auth_sessions_operator_id", "operator_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    operator_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "operators.id",
            name="fk_auth_sessions_operator_id_operators",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    operator: Mapped[Operator] = relationship(back_populates="auth_sessions")


class Barangay(Base):
    __tablename__ = "barangays"
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    boundary: Mapped[Any | None] = mapped_column(
        Geometry("MULTIPOLYGON", srid=4326, spatial_index=False)
    )
    centroid: Mapped[Any | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    incident_reports: Mapped[list["IncidentReport"]] = relationship(
        back_populates="barangay"
    )

    __table_args__ = (
        UniqueConstraint("name", name="uq_barangays_name"),
        Index(
            "idx_barangays_boundary",
            "boundary",
            postgresql_using="gist",
        ),
    )


class IncidentType(Base):
    __tablename__ = "incident_types"
    __table_args__ = (UniqueConstraint("name", name="uq_incident_types_name"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    incident_reports: Mapped[list["IncidentReport"]] = relationship(
        back_populates="incident_type"
    )


class Responder(Base):
    __tablename__ = "responders"
    __table_args__ = (
        UniqueConstraint("call_sign", name="uq_responders_call_sign"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    call_sign: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    incoming_messages: Mapped[list["Message"]] = relationship(
        back_populates="sender_responder",
        foreign_keys="Message.sender_responder_id",
        passive_deletes="all",
    )
    incident_reports: Mapped[list["IncidentReport"]] = relationship(
        back_populates="responder"
    )
    locations: Mapped[list["ResponderLocation"]] = relationship(
        back_populates="responder", passive_deletes="all"
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "direction IN ('incoming', 'outgoing')",
            name="ck_messages_direction_values",
        ),
        CheckConstraint(
            "(direction = 'incoming' AND sender_responder_id IS NOT NULL "
            "AND sender_operator_id IS NULL) OR "
            "(direction = 'outgoing' AND sender_operator_id IS NOT NULL "
            "AND sender_responder_id IS NULL)",
            name="ck_messages_sender_matches_direction",
        ),
        CheckConstraint(
            "transmission_status IN "
            "('received', 'queued', 'preparing', 'sending', 'audio_complete', "
            "'delivered', 'failed', 'delivery_unknown', 'transmitting', 'sent', 'canceled')",
            name="ck_messages_transmission_status_values",
        ),
        Index(
            "idx_messages_direction_status", "direction", "transmission_status"
        ),
        Index(
            "idx_messages_location", "location", postgresql_using="gist"
        ),
        Index("idx_messages_received_at", text("received_at DESC")),
        Index("idx_messages_sent_at", text("sent_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    direction: Mapped[str] = mapped_column(Text, nullable=False)
    sender_responder_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("responders.id", name="fk_messages_sender_responder_id_responders"),
    )
    sender_operator_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("operators.id", name="fk_messages_sender_operator_id_operators"),
    )
    body: Mapped[str | None] = mapped_column(Text)
    sample_owner_operator_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"),
        nullable=True,
    )
    decoded_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    location: Mapped[Any | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transmission_status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'received'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    sender_responder: Mapped[Responder | None] = relationship(
        back_populates="incoming_messages", foreign_keys=[sender_responder_id]
    )
    sender_operator: Mapped[Operator | None] = relationship(
        back_populates="sent_messages", foreign_keys=[sender_operator_id]
    )
    incident_report: Mapped["IncidentReport | None"] = relationship(
        back_populates="source_message", uselist=False
    )
    transmission_attempts: Mapped[list["MessageTransmissionAttempt"]] = relationship(
        back_populates="message", passive_deletes="all"
    )
    media_attachments: Mapped[list["MediaAttachment"]] = relationship(
        back_populates="message", passive_deletes="all"
    )
    responder_locations: Mapped[list["ResponderLocation"]] = relationship(
        back_populates="received_message"
    )


class IncidentReport(Base):
    __tablename__ = "incident_reports"
    __table_args__ = (
        UniqueConstraint("report_code", name="uq_incident_reports_report_code"),
        UniqueConstraint(
            "source_message_id", name="uq_incident_reports_source_message_id"
        ),
        Index(
            "idx_incident_reports_barangay_reported_at",
            "barangay_id",
            text("reported_at DESC"),
        ),
        Index(
            "idx_incident_reports_location", "location", postgresql_using="gist"
        ),
        Index(
            "idx_incident_reports_reported_at", text("reported_at DESC")
        ),
        Index(
            "idx_incident_reports_type_reported_at",
            "incident_type_id",
            text("reported_at DESC"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    sample_owner_operator_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"),
        nullable=True,
    )
    report_code: Mapped[str] = mapped_column(Text, nullable=False)
    source_message_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "messages.id",
            name="fk_incident_reports_source_message_id_messages",
            ondelete="SET NULL",
        ),
    )
    incident_type_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey(
            "incident_types.id",
            name="fk_incident_reports_incident_type_id_incident_types",
            ondelete="SET NULL",
        ),
    )
    responder_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "responders.id",
            name="fk_incident_reports_responder_id_responders",
            ondelete="SET NULL",
        ),
    )
    barangay_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey(
            "barangays.id",
            name="fk_incident_reports_barangay_id_barangays",
            ondelete="SET NULL",
        ),
    )
    location_description: Mapped[str | None] = mapped_column(Text)
    details: Mapped[str | None] = mapped_column(Text)
    location: Mapped[Any | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'received'")
    )
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    source_message: Mapped[Message | None] = relationship(
        back_populates="incident_report"
    )
    incident_type: Mapped[IncidentType | None] = relationship(
        back_populates="incident_reports"
    )
    responder: Mapped[Responder | None] = relationship(
        back_populates="incident_reports"
    )
    barangay: Mapped[Barangay | None] = relationship(
        back_populates="incident_reports"
    )
    media_attachments: Mapped[list["MediaAttachment"]] = relationship(
        back_populates="incident_report", passive_deletes="all"
    )


class MessageTransmissionAttempt(Base):
    __tablename__ = "message_transmission_attempts"
    __table_args__ = (
        CheckConstraint(
            "attempt_number > 0",
            name="ck_message_transmission_attempts_attempt_number_positive",
        ),
        CheckConstraint(
            "status IN ('queued', 'preparing', 'sending', 'audio_complete', "
            "'delivered', 'failed', 'delivery_unknown', 'transmitting', 'sent', 'canceled')",
            name="ck_message_transmission_attempts_status_values",
        ),
        UniqueConstraint(
            "message_id", "attempt_number", name="uq_transmission_attempt_number"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    message_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "messages.id",
            name="fk_message_transmission_attempts_message_id_messages",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    result_details: Mapped[str | None] = mapped_column(Text)

    message: Mapped[Message] = relationship(back_populates="transmission_attempts")


class MediaAttachment(Base):
    __tablename__ = "media_attachments"
    __table_args__ = (
        CheckConstraint(
            "message_id IS NOT NULL OR incident_report_id IS NOT NULL",
            name="ck_media_attachments_attachment_has_parent",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    message_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "messages.id",
            name="fk_media_attachments_message_id_messages",
            ondelete="CASCADE",
        ),
    )
    incident_report_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "incident_reports.id",
            name="fk_media_attachments_incident_report_id_incident_reports",
            ondelete="CASCADE",
        ),
    )
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    # Every manual association records which approved operator confirmed it.
    linked_by_operator_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("operators.id", ondelete="SET NULL")
    )
    linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    message: Mapped[Message | None] = relationship(
        back_populates="media_attachments"
    )
    incident_report: Mapped[IncidentReport | None] = relationship(
        back_populates="media_attachments"
    )
    enhancements: Mapped[list["ImageEnhancement"]] = relationship(
        back_populates="attachment", passive_deletes="all"
    )


class ImageEnhancement(Base):
    __tablename__ = "image_enhancements"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    attachment_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "media_attachments.id",
            name="fk_image_enhancements_attachment_id_media_attachments",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "operators.id",
            name="fk_image_enhancements_operator_id_operators",
            ondelete="SET NULL",
        ),
    )
    enhanced_storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    enhancement_parameters: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    enhanced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    attachment: Mapped[MediaAttachment] = relationship(back_populates="enhancements")
    operator: Mapped[Operator | None] = relationship(
        back_populates="image_enhancements"
    )


class ResponderLocation(Base):
    __tablename__ = "responder_locations"
    __table_args__ = (
        Index(
            "idx_responder_locations_location",
            "location",
            postgresql_using="gist",
        ),
        Index(
            "idx_responder_locations_responder_recorded_at",
            "responder_id",
            text("recorded_at DESC"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    responder_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "responders.id",
            name="fk_responder_locations_responder_id_responders",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    received_message_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "messages.id",
            name="fk_responder_locations_received_message_id_messages",
            ondelete="SET NULL",
        ),
    )
    location: Mapped[Any] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    responder: Mapped[Responder] = relationship(back_populates="locations")
    received_message: Mapped[Message | None] = relationship(
        back_populates="responder_locations"
    )
