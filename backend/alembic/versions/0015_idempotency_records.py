"""Persist idempotent assignment-create responses.

Revision ID: 0015_idempotency_records
Revises: 0014_timezone_aware_timestamps
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_idempotency_records"
down_revision = "0014_timezone_aware_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_table(
		"idempotency_records",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("operation_id", sa.String(length=128), nullable=False),
		sa.Column("request_hash", sa.String(length=64), nullable=False),
		sa.Column("response_status", sa.Integer(), nullable=False),
		sa.Column("response_body", sa.JSON(), nullable=False),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("user_id", "operation_id", name="uq_idempotency_user_operation"),
	)
	op.create_index("ix_idempotency_records_user_id", "idempotency_records", ["user_id"])


def downgrade() -> None:
	op.drop_index("ix_idempotency_records_user_id", table_name="idempotency_records")
	op.drop_table("idempotency_records")
