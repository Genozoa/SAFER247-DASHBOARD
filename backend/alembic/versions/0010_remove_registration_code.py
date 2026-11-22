"""Remove registration-code verification metadata without changing operator identities.

Previously inactive accounts remain inactive. Existing password hashes and
authentication sessions are not modified.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_remove_registration_code"
down_revision = "0009_registration_cleanup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("operators", "registration_verified_at")


def downgrade() -> None:
    # An old, unused verification marker cannot be reconstructed faithfully.
    # Restored values do not bypass any modern login checks.
    op.add_column("operators", sa.Column("registration_verified_at", sa.DateTime(timezone=True), nullable=True))
