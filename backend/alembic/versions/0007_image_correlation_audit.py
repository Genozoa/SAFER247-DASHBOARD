"""Record who manually associated a decoded SSTV image with an incident."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_image_correlation_audit"
down_revision = "0006_operator_approval"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("media_attachments", sa.Column("linked_by_operator_id", postgresql.UUID(as_uuid=True)))
    op.add_column("media_attachments", sa.Column("linked_at", sa.DateTime(timezone=True)))
    op.create_foreign_key("fk_media_linked_by_operator", "media_attachments", "operators", ["linked_by_operator_id"], ["id"], ondelete="SET NULL")

def downgrade():
    op.drop_constraint("fk_media_linked_by_operator", "media_attachments", type_="foreignkey")
    op.drop_column("media_attachments", "linked_at")
    op.drop_column("media_attachments", "linked_by_operator_id")
