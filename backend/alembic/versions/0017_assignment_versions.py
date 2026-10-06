"""Add optimistic-lock versions to assignments.

Revision ID: 0017_assignment_versions
Revises: 0016_refresh_tokens
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_assignment_versions"
down_revision = "0016_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column(
		"assignments",
		sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
	)


def downgrade() -> None:
	op.drop_column("assignments", "version")
