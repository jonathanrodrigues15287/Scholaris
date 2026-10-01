"""Track assignment due dates notified by email.

Revision ID: 0013_deadline_email_reminders
Revises: 0012_add_usernames
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_deadline_email_reminders"
down_revision = "0012_add_usernames"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("assignments", sa.Column("deadline_email_sent_for", sa.Date(), nullable=True))


def downgrade() -> None:
	op.drop_column("assignments", "deadline_email_sent_for")
