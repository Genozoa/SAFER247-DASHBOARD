"""Replace approval records with proof of registration-code verification.

Previously approved operator accounts remain verified. Never-approved legacy
accounts remain blocked until the owner confirms the code with their password.
All password hashes and sessions are preserved.
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_registration_cleanup"
down_revision = "0008_sample_data_ownership"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("operators", sa.Column("registration_verified_at", sa.DateTime(timezone=True)))
    op.execute(
        "UPDATE operators SET registration_verified_at = COALESCE(approved_at, created_at, now()) "
        "WHERE is_approved IS TRUE"
    )
    op.drop_constraint("ck_operators_role", "operators", type_="check")
    op.drop_column("operators", "approved_at")
    op.drop_column("operators", "is_approved")
    op.drop_column("operators", "role")
    op.drop_table("operator_auth")


def downgrade() -> None:
    raise RuntimeError(
        "Reversing operator verification and removed authentication metadata "
        "requires a reviewed restore from the pre-upgrade database backup."
    )
