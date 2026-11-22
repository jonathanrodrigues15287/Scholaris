"""Add atomic idempotency reservation state.

Revision ID: 0018_idempotency_reservations
Revises: 0017_assignment_versions
Create Date: 2026-11-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_idempotency_reservations"
down_revision = "0017_assignment_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
	with op.batch_alter_table("idempotency_records") as batch_op:
		batch_op.add_column(
			sa.Column("state", sa.String(length=16), nullable=False, server_default="pending")
		)
		batch_op.alter_column("response_status", existing_type=sa.Integer(), nullable=True)
		batch_op.alter_column(
			"response_body",
			existing_type=sa.JSON(),
			nullable=True,
		)
	op.execute(
		"UPDATE idempotency_records SET state = 'completed' "
		"WHERE state = 'pending' AND response_status IS NOT NULL"
	)


def downgrade() -> None:
	op.execute("DELETE FROM idempotency_records WHERE response_status IS NULL")
	with op.batch_alter_table("idempotency_records") as batch_op:
		batch_op.drop_column("state")
		batch_op.alter_column("response_status", existing_type=sa.Integer(), nullable=False)
		batch_op.alter_column(
			"response_body",
			existing_type=sa.JSON(),
			nullable=False,
		)
