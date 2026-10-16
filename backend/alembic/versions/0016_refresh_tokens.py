"""Store and rotate refresh tokens server-side.

Revision ID: 0016_refresh_tokens
Revises: 0015_idempotency_records
Create Date: 2026-10-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_refresh_tokens"
down_revision = "0015_idempotency_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_table(
		"refresh_tokens",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("token_hash", sa.String(length=64), nullable=False),
		sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
		sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
		sa.Column("replaced_by", sa.Integer(), nullable=True),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["replaced_by"], ["refresh_tokens.id"]),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
	op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])


def downgrade() -> None:
	op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
	op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
	op.drop_table("refresh_tokens")
