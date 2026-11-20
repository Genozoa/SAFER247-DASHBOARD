from alembic import op


revision = "0005_canceled_radio_status"
down_revision = "0004_transmission_statuses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_messages_transmission_status_values", "messages", type_="check")
    op.create_check_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        "transmission_status IN "
        "('received', 'queued', 'preparing', 'sending', 'audio_complete', "
        "'delivered', 'failed', 'delivery_unknown', 'transmitting', 'sent', 'canceled')",
    )
    op.drop_constraint("ck_message_transmission_attempts_status_values", "message_transmission_attempts", type_="check")
    op.create_check_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        "status IN "
        "('queued', 'preparing', 'sending', 'audio_complete', 'delivered', "
        "'failed', 'delivery_unknown', 'transmitting', 'sent', 'canceled')",
    )


def downgrade() -> None:
    op.execute("UPDATE messages SET transmission_status = 'failed' WHERE transmission_status = 'canceled'")
    op.execute("UPDATE message_transmission_attempts SET status = 'failed' WHERE status = 'canceled'")
    op.drop_constraint("ck_messages_transmission_status_values", "messages", type_="check")
    op.create_check_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        "transmission_status IN "
        "('received', 'queued', 'preparing', 'sending', 'audio_complete', "
        "'delivered', 'failed', 'delivery_unknown', 'transmitting', 'sent')",
    )
    op.drop_constraint("ck_message_transmission_attempts_status_values", "message_transmission_attempts", type_="check")
    op.create_check_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        "status IN "
        "('queued', 'preparing', 'sending', 'audio_complete', 'delivered', "
        "'failed', 'delivery_unknown', 'transmitting', 'sent')",
    )
