from alembic import op


revision = "0004_transmission_statuses"
down_revision = "0003_single_operator_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        type_="check",
    )
    op.create_check_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        "transmission_status IN "
        "('received', 'queued', 'preparing', 'sending', 'audio_complete', "
        "'delivered', 'failed', 'delivery_unknown', 'transmitting', 'sent')",
    )
    op.drop_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        type_="check",
    )
    op.create_check_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        "status IN "
        "('queued', 'preparing', 'sending', 'audio_complete', 'delivered', "
        "'failed', 'delivery_unknown', 'transmitting', 'sent')",
    )


def downgrade() -> None:
    op.execute(
        "UPDATE messages SET transmission_status = CASE transmission_status "
        "WHEN 'preparing' THEN 'transmitting' WHEN 'sending' THEN 'transmitting' "
        "WHEN 'audio_complete' THEN 'sent' WHEN 'delivered' THEN 'sent' "
        "WHEN 'delivery_unknown' THEN 'failed' ELSE transmission_status END"
    )
    op.execute(
        "UPDATE message_transmission_attempts SET status = CASE status "
        "WHEN 'preparing' THEN 'transmitting' WHEN 'sending' THEN 'transmitting' "
        "WHEN 'audio_complete' THEN 'sent' WHEN 'delivered' THEN 'sent' "
        "WHEN 'delivery_unknown' THEN 'failed' ELSE status END"
    )
    op.drop_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        type_="check",
    )
    op.create_check_constraint(
        "ck_messages_transmission_status_values",
        "messages",
        "transmission_status IN ('received', 'queued', 'transmitting', 'sent', 'failed')",
    )
    op.drop_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        type_="check",
    )
    op.create_check_constraint(
        "ck_message_transmission_attempts_status_values",
        "message_transmission_attempts",
        "status IN ('queued', 'transmitting', 'sent', 'failed')",
    )
