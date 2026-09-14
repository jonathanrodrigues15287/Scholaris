"""Add integrity constraints, query indexes, and audit fields.

Revision ID: 0002_integrity_and_audit_fields
Revises: 0001_initial
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_integrity_and_audit_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

_NOW = sa.text("CURRENT_TIMESTAMP")


def _add_audit_columns(table: str, *, created: bool = False, deleted: bool = False) -> None:
	if created:
		op.add_column(
			table,
			sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
		)
	op.add_column(
		table,
		sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
	)
	if deleted:
		op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def upgrade() -> None:
	_add_audit_columns("users")
	_add_audit_columns("courses", created=True, deleted=True)
	_add_audit_columns("assignments", deleted=True)
	_add_audit_columns("attendance", created=True)
	_add_audit_columns("semesters", created=True)
	_add_audit_columns("study_sessions", created=True)
	_add_audit_columns("timetable", created=True)

	op.create_unique_constraint(
		"uq_attendance_user_course_date",
		"attendance",
		["user_id", "course_id", "date"],
	)
	op.create_index("ix_attendance_user_date", "attendance", ["user_id", "date"])
	op.create_index(
		"ix_courses_user_name",
		"courses",
		["user_id", "name"],
	)
	op.create_index(
		"ix_assignments_user_status_due",
		"assignments",
		["user_id", "status", "due_date"],
	)
	op.create_index(
		"ix_study_sessions_user_start",
		"study_sessions",
		["user_id", "start_time"],
	)
	op.create_index(
		"ix_timetable_user_day_start",
		"timetable",
		["user_id", "day", "start_time"],
	)


def downgrade() -> None:
	op.drop_index("ix_timetable_user_day_start", table_name="timetable")
	op.drop_index("ix_study_sessions_user_start", table_name="study_sessions")
	op.drop_index("ix_assignments_user_status_due", table_name="assignments")
	op.drop_index("ix_courses_user_name", table_name="courses")
	op.drop_index("ix_attendance_user_date", table_name="attendance")
	op.drop_constraint("uq_attendance_user_course_date", "attendance", type_="unique")

	for table, columns in (
		("timetable", ("updated_at", "created_at")),
		("study_sessions", ("updated_at", "created_at")),
		("semesters", ("updated_at", "created_at")),
		("attendance", ("updated_at", "created_at")),
		("assignments", ("deleted_at", "updated_at")),
		("courses", ("deleted_at", "updated_at", "created_at")),
		("users", ("updated_at",)),
	):
		for column in columns:
			op.drop_column(table, column)
