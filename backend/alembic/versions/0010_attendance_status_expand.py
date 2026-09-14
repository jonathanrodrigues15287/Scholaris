"""Expand attendance status constraint to include holiday and exam.

Revision ID: 0010_attendance_status_expand
Revises: 0009_query_indexes
Create Date: 2026-09-11
"""

from alembic import op


revision = "0010_attendance_status_expand"
down_revision = "0009_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
	# Drop the old constraint that only permitted 'present' and 'absent'
	op.drop_constraint("ck_attendance_status", "attendance", type_="check")
	# Re-create with all four valid statuses
	op.create_check_constraint(
		"ck_attendance_status",
		"attendance",
		"status IN ('present', 'absent', 'holiday', 'exam')",
	)


def downgrade() -> None:
	op.drop_constraint("ck_attendance_status", "attendance", type_="check")
	op.create_check_constraint(
		"ck_attendance_status",
		"attendance",
		"status IN ('present', 'absent')",
	)
