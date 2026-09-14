"""Enforce assignment priority and recurrence invariants.

Revision ID: 0004_assignment_invariants
Revises: 0003_assignment_lifecycle
Create Date: 2026-09-10
"""

from alembic import op


revision = "0004_assignment_invariants"
down_revision = "0003_assignment_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_check_constraint(
		"ck_assignments_priority",
		"assignments",
		"priority IN ('high', 'medium', 'low')",
	)
	op.create_check_constraint(
		"ck_assignments_priority_mode",
		"assignments",
		"priority_mode IN ('manual', 'auto')",
	)
	op.create_check_constraint(
		"ck_assignments_recurrence_requires_due_date",
		"assignments",
		"recurrence_rule IS NULL OR due_date IS NOT NULL",
	)


def downgrade() -> None:
	op.drop_constraint("ck_assignments_recurrence_requires_due_date", "assignments", type_="check")
	op.drop_constraint("ck_assignments_priority_mode", "assignments", type_="check")
	op.drop_constraint("ck_assignments_priority", "assignments", type_="check")
