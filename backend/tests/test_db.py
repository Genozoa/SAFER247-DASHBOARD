from pathlib import Path

import pytest
from geoalchemy2 import Geography, Geometry
from sqlalchemy import Integer, String, create_engine, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.schema import CreateTable
from sqlalchemy.sql.sqltypes import DateTime

from app.db.base import Base
from app.db.models import (
    Barangay,
    ImageEnhancement,
    IncidentReport,
    MediaAttachment,
    Message,
    MessageTransmissionAttempt,
    Operator,
    Responder,
    ResponderLocation,
)
from app.db.session import (
    create_db_engine,
    create_session_factory,
    get_database_url,
    session_scope,
)


class SessionTestBase(DeclarativeBase):
    pass


class SessionProbe(SessionTestBase):
    __tablename__ = "session_probe"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)


def test_model_tables_and_postgres_specific_types_match_schema() -> None:
    expected_tables = {
        "operators",
        "barangays",
        "incident_types",
        "responders",
        "messages",
        "incident_reports",
        "message_transmission_attempts",
        "media_attachments",
        "image_enhancements",
        "responder_locations",
        "operator_auth",
        "auth_sessions",
    }
    assert set(Base.metadata.tables) == expected_tables
    assert {
        table.primary_key.name for table in Base.metadata.tables.values()
    } == {f"pk_{table_name}" for table_name in expected_tables}

    assert isinstance(Barangay.__table__.c.boundary.type, Geometry)
    assert isinstance(Barangay.__table__.c.centroid.type, Geography)
    assert isinstance(Message.__table__.c.decoded_payload.type, postgresql.JSONB)
    assert isinstance(Message.__table__.c.id.type, postgresql.UUID)
    assert isinstance(Operator.__table__.c.created_at.type, DateTime)
    assert set(Operator.__table__.c.keys()) >= {
        "username",
        "password_hash",
    }
    assert "display_name" not in Operator.__table__.c
    assert Barangay.__table__.c.boundary.type.geometry_type == "MULTIPOLYGON"
    assert Barangay.__table__.c.boundary.type.srid == 4326

    ddl = str(CreateTable(Message.__table__).compile(dialect=postgresql.dialect()))
    assert "JSONB" in ddl
    assert "geography(POINT,4326)" in ddl


def test_schema_constraints_and_indexes_are_present() -> None:
    assert {
        constraint.name for constraint in Message.__table__.constraints
    } >= {
        "ck_messages_direction_values",
        "ck_messages_sender_matches_direction",
        "ck_messages_transmission_status_values",
    }
    assert {
        index.name for index in IncidentReport.__table__.indexes
    } >= {
        "idx_incident_reports_barangay_reported_at",
        "idx_incident_reports_location",
        "idx_incident_reports_reported_at",
        "idx_incident_reports_type_reported_at",
    }
    assert next(iter(
        MessageTransmissionAttempt.__table__.c.message_id.foreign_keys
    )).ondelete == "CASCADE"
    assert next(iter(
        IncidentReport.__table__.c.barangay_id.foreign_keys
    )).ondelete == "SET NULL"
    assert next(iter(
        MediaAttachment.__table__.c.message_id.foreign_keys
    )).ondelete == "CASCADE"
    assert next(iter(
        ImageEnhancement.__table__.c.operator_id.foreign_keys
    )).ondelete == "SET NULL"
    assert next(iter(
        ResponderLocation.__table__.c.responder_id.foreign_keys
    )).ondelete == "CASCADE"


def test_session_scope_commits_and_closes_session() -> None:
    engine = create_engine("sqlite://")
    SessionTestBase.metadata.create_all(engine)
    factory = create_session_factory(engine)

    with session_scope(factory) as session:
        session.add(SessionProbe(value="persisted"))

    with factory() as verification_session:
        assert verification_session.scalar(
            select(SessionProbe.value)
        ) == "persisted"
    engine.dispose()


def test_session_scope_rolls_back_on_error() -> None:
    engine = create_engine("sqlite://")
    SessionTestBase.metadata.create_all(engine)
    factory = create_session_factory(engine)

    with pytest.raises(ValueError):
        with session_scope(factory) as session:
            session.add(SessionProbe(value="rolled back"))
            raise ValueError("abort transaction")

    with factory() as verification_session:
        assert verification_session.scalar(select(SessionProbe.id)) is None
    engine.dispose()


def test_database_url_is_required_and_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL is not set"):
        get_database_url()

    engine = create_db_engine("sqlite://")
    assert engine.url.drivername == "sqlite"
    engine.dispose()
