"""Review legacy accounts before granting access."""
from alembic import op
import sqlalchemy as sa

revision = "0006_operator_approval"
down_revision = "0005_canceled_radio_status"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("operators", sa.Column("is_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("operators", sa.Column("role", sa.Text(), nullable=False, server_default=sa.text("'viewer'")))
    op.add_column("operators", sa.Column("approved_at", sa.DateTime(timezone=True)))
    op.create_check_constraint("ck_operators_role", "operators", "role IN ('viewer', 'operator', 'admin')")

def downgrade():
    op.drop_constraint("ck_operators_role", "operators", type_="check")
    op.drop_column("operators", "approved_at")
    op.drop_column("operators", "role")
    op.drop_column("operators", "is_approved")
