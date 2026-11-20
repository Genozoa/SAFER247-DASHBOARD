from alembic import op


revision = "0003_single_operator_name"
down_revision = "0002_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE operators DROP COLUMN IF EXISTS display_name")


def downgrade() -> None:
    raise RuntimeError(
        "The removed operator display name may have differed from the username. "
        "Restore from a backup before attempting to reverse this migration."
    )
