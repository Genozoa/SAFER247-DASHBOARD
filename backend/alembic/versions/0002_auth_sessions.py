from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_auth_sessions"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operator_auth",
        sa.Column("operator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("password_fingerprint", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["operators.id"],
            name="fk_operator_auth_operator_id_operators",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("operator_id", name="pk_operator_auth"),
        sa.UniqueConstraint(
            "password_fingerprint",
            name="uq_operator_auth_password_fingerprint",
        ),
        if_not_exists=True,
    )
    op.create_table(
        "auth_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("operator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["operators.id"],
            name="fk_auth_sessions_operator_id_operators",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_auth_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        if_not_exists=True,
    )
    op.create_index(
        "idx_auth_sessions_operator_id",
        "auth_sessions",
        ["operator_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    raise RuntimeError(
        "Authentication tables contain credential fingerprints and active "
        "sessions. Removing them requires a reviewed, explicit migration."
    )
