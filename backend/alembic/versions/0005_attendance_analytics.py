"""Add attendance history, semester links, and threshold settings.

Revision ID: 0005_attendance_analytics
Revises: 0004_assignment_invariants
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_attendance_analytics"
down_revision = "0004_assignment_invariants"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column(
		"users",
		sa.Column("minimum_attendance_threshold", sa.Float(), server_default="75", nullable=False),
	)
	op.add_column(
		"attendance",
		sa.Column("semester_id", sa.Integer(), nullable=True),
	)
	op.create_foreign_key(
		"fk_attendance_semester_id",
		"attendance",
		"semesters",
		["semester_id"],
		["id"],
		ondelete="SET NULL",
	)
	op.create_index("ix_attendance_semester_id", "attendance", ["semester_id"])
	op.create_check_constraint(
		"ck_attendance_status",
		"attendance",
		"status IN ('present', 'absent')",
	)
	op.create_table(
		"attendance_history",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("attendance_id", sa.Integer(), nullable=True),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("course_id", sa.Integer(), nullable=False),
		sa.Column("semester_id", sa.Integer(), nullable=True),
		sa.Column("date", sa.Date(), nullable=False),
		sa.Column("event", sa.String(length=20), nullable=False),
		sa.Column("from_status", sa.String(length=10), nullable=True),
		sa.Column("to_status", sa.String(length=10), nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
		sa.ForeignKeyConstraint(["attendance_id"], ["attendance.id"], ondelete="SET NULL"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index("ix_attendance_history_attendance_id", "attendance_history", ["attendance_id"])
	op.create_index("ix_attendance_history_user_id", "attendance_history", ["user_id"])
	op.create_index("ix_attendance_history_course_id", "attendance_history", ["course_id"])
	op.create_index("ix_attendance_history_user_created", "attendance_history", ["user_id", "created_at"])


def downgrade() -> None:
	op.drop_index("ix_attendance_history_user_created", table_name="attendance_history")
	op.drop_index("ix_attendance_history_course_id", table_name="attendance_history")
	op.drop_index("ix_attendance_history_user_id", table_name="attendance_history")
	op.drop_index("ix_attendance_history_attendance_id", table_name="attendance_history")
	op.drop_table("attendance_history")
	op.drop_constraint("ck_attendance_status", "attendance", type_="check")
	op.drop_index("ix_attendance_semester_id", table_name="attendance")
	op.drop_constraint("fk_attendance_semester_id", "attendance", type_="foreignkey")
	op.drop_column("semester_id", table_name="attendance")
	op.drop_column("minimum_attendance_threshold", table_name="users")
