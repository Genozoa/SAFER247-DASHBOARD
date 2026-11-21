"""Attach development-only synthetic operational rows to the Demo operator."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_sample_data_ownership"
down_revision = "0007_image_correlation_audit"
branch_labels = None
depends_on = None

def upgrade():
    for table in ("messages", "incident_reports"):
        op.add_column(table, sa.Column("sample_owner_operator_id", postgresql.UUID(as_uuid=True)))
        op.create_foreign_key(f"fk_{table}_sample_owner", table, "operators",
                              ["sample_owner_operator_id"], ["id"], ondelete="CASCADE")
        op.create_index(f"idx_{table}_sample_owner", table, ["sample_owner_operator_id"])

def downgrade():
    for table in ("messages", "incident_reports"):
        op.drop_index(f"idx_{table}_sample_owner", table_name=table)
        op.drop_constraint(f"fk_{table}_sample_owner", table, type_="foreignkey")
        op.drop_column(table, "sample_owner_operator_id")
