from alembic import op
from alembic import context
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db.base import Base
from app.db import models  # noqa: F401


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None
INITIAL_TABLES = (
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
)


def initial_tables():
    return [Base.metadata.tables[name] for name in INITIAL_TABLES]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    if context.is_offline_mode():
        dialect = postgresql.dialect()
        tables = initial_tables()
        for table in tables:
            op.execute(str(CreateTable(table).compile(dialect=dialect)))
        for table in tables:
            for index in table.indexes:
                op.execute(str(CreateIndex(index).compile(dialect=dialect)))
    else:
        Base.metadata.create_all(
            bind=op.get_bind(), tables=initial_tables(), checkfirst=True
        )


def downgrade() -> None:
    raise RuntimeError(
        "The initial schema migration is intentionally non-destructive. "
        "Back up the database and create an explicit data migration before "
        "removing schema objects."
    )
