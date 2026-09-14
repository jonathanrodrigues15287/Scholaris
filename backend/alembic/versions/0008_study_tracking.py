"""Add assignment-linked study tracking and study goals.

Revision ID: 0008_study_tracking
Revises: 0007_academic_records
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_study_tracking"
down_revision = "0007_academic_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("study_sessions", sa.Column("assignment_id", sa.Integer(), nullable=True))
	op.create_foreign_key(
		"fk_study_sessions_assignment_id",
		"study_sessions",
		"assignments",
		["assignment_id"],
		["id"],
		ondelete="SET NULL",
	)
	op.create_index("ix_study_sessions_assignment_id", "study_sessions", ["assignment_id"])
	op.add_column("users", sa.Column("weekly_study_goal_minutes", sa.Integer(), nullable=False, server_default="300"))


def downgrade() -> None:
	op.drop_column("users", "weekly_study_goal_minutes")
	op.drop_index("ix_study_sessions_assignment_id", table_name="study_sessions")
	op.drop_constraint("fk_study_sessions_assignment_id", "study_sessions", type_="foreignkey")
	op.drop_column("study_sessions", "assignment_id")
