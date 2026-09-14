"""Add canonical assignment lifecycle and history.

Revision ID: 0003_assignment_lifecycle
Revises: 0002_integrity_and_audit_fields
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_assignment_lifecycle"
down_revision = "0002_integrity_and_audit_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("assignments", sa.Column("recurrence_rule", sa.String(length=40), nullable=True))
	op.add_column("assignments", sa.Column("recurrence_until", sa.Date(), nullable=True))
	op.add_column("assignments", sa.Column("reminder_at", sa.DateTime(timezone=True), nullable=True))
	op.add_column("assignments", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
	op.add_column("assignments", sa.Column("attachment_name", sa.String(length=255), nullable=True))
	op.add_column("assignments", sa.Column("attachment_url", sa.String(length=2048), nullable=True))
	op.add_column("assignments", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
	op.add_column("assignments", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))

	op.execute(
		"UPDATE assignments SET status = 'submitted' WHERE is_submitted = TRUE"
	)
	op.execute(
		"UPDATE assignments SET status = 'completed' WHERE is_submitted = FALSE AND is_completed = TRUE"
	)
	op.execute(
		"UPDATE assignments SET is_completed = TRUE WHERE status IN ('completed', 'submitted')"
	)
	op.execute(
		"UPDATE assignments SET is_submitted = TRUE WHERE status = 'submitted'"
	)
	op.create_check_constraint(
		"ck_assignments_status",
		"assignments",
		"status IN ('pending', 'in_progress', 'completed', 'submitted')",
	)
	op.create_check_constraint(
		"ck_assignments_completed_projection",
		"assignments",
		"is_completed = (status IN ('completed', 'submitted'))",
	)
	op.create_check_constraint(
		"ck_assignments_submitted_projection",
		"assignments",
		"is_submitted = (status = 'submitted')",
	)

	op.create_table(
		"assignment_history",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("assignment_id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("event", sa.String(length=30), nullable=False),
		sa.Column("from_status", sa.String(length=20), nullable=True),
		sa.Column("to_status", sa.String(length=20), nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
		sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index("ix_assignment_history_assignment_id", "assignment_history", ["assignment_id"])
	op.create_index(
		"ix_assignment_history_assignment_created",
		"assignment_history",
		["assignment_id", "created_at"],
	)
	op.create_index("ix_assignment_history_user_id", "assignment_history", ["user_id"])


def downgrade() -> None:
	op.drop_index("ix_assignment_history_user_id", table_name="assignment_history")
	op.drop_index("ix_assignment_history_assignment_created", table_name="assignment_history")
	op.drop_index("ix_assignment_history_assignment_id", table_name="assignment_history")
	op.drop_table("assignment_history")
	op.drop_constraint("ck_assignments_submitted_projection", "assignments", type_="check")
	op.drop_constraint("ck_assignments_completed_projection", "assignments", type_="check")
	op.drop_constraint("ck_assignments_status", "assignments", type_="check")
	for column in (
		"submitted_at",
		"completed_at",
		"attachment_url",
		"attachment_name",
		"reminder_sent_at",
		"reminder_at",
		"recurrence_until",
		"recurrence_rule",
	):
		op.drop_column("assignments", column)
