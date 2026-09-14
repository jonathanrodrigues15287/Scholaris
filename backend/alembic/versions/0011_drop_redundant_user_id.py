"""Drop redundant user_id from timetable, timetable_exceptions, and attendance.

Ownership of these rows is already fully determined through their
course_id → courses.user_id FK chain.  Carrying a second user_id creates
two independent ownership claims that the database never enforces are equal.

study_sessions.user_id is intentionally kept: course_id is nullable there
(general sessions have no course), so user_id is the only owner anchor.
attendance_history.user_id is kept as intentional audit-log denormalization.

Revision ID: 0011_drop_redundant_user_id
Revises: 0010_attendance_status_expand
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_drop_redundant_user_id"
down_revision = "0010_attendance_status_expand"
branch_labels = None
depends_on = None


def upgrade() -> None:
	# ── attendance ─────────────────────────────────────────────────────────
	# Drop the composite indexes that include user_id before removing the column.
	op.drop_index("ix_attendance_user_date", table_name="attendance")
	op.drop_index("ix_attendance_user_status_date", table_name="attendance")
	op.drop_constraint("ck_attendance_status", "attendance", type_="check")
	# Drop FK then column.
	op.drop_constraint("attendance_user_id_fkey", "attendance", type_="foreignkey")
	op.drop_column("attendance", "user_id")
	# Re-create the indexes without user_id, still useful for range queries.
	op.create_index("ix_attendance_course_date", "attendance", ["course_id", "date"])
	op.create_index("ix_attendance_course_status_date", "attendance", ["course_id", "status", "date"])
	# Re-create check constraint (name unchanged so downgrade can drop it again).
	op.create_check_constraint(
		"ck_attendance_status",
		"attendance",
		"status IN ('present', 'absent', 'holiday', 'exam')",
	)

	# ── timetable ──────────────────────────────────────────────────────────
	op.drop_index("ix_timetable_user_day_start", table_name="timetable")
	op.drop_constraint("timetable_user_id_fkey", "timetable", type_="foreignkey")
	op.drop_column("timetable", "user_id")
	op.create_index("ix_timetable_course_day_start", "timetable", ["course_id", "day", "start_time"])

	# ── timetable_exceptions ───────────────────────────────────────────────
	op.drop_index("ix_timetable_exceptions_user_id", table_name="timetable_exceptions")
	op.drop_index("ix_timetable_exceptions_user_date", table_name="timetable_exceptions")
	op.drop_constraint("timetable_exceptions_user_id_fkey", "timetable_exceptions", type_="foreignkey")
	op.drop_column("timetable_exceptions", "user_id")


def downgrade() -> None:
	# ── timetable_exceptions ───────────────────────────────────────────────
	# Back-fill user_id from the linked timetable → course → user chain.
	op.add_column(
		"timetable_exceptions",
		sa.Column("user_id", sa.Integer(), nullable=True),
	)
	op.execute(
		"""
		UPDATE timetable_exceptions te
		SET user_id = (
			SELECT c.user_id
			FROM timetable t
			JOIN courses c ON c.id = t.course_id
			WHERE t.id = te.timetable_id
		)
		"""
	)
	op.alter_column("timetable_exceptions", "user_id", nullable=False)
	op.create_foreign_key(
		"timetable_exceptions_user_id_fkey",
		"timetable_exceptions",
		"users",
		["user_id"],
		["id"],
		ondelete="CASCADE",
	)
	op.create_index("ix_timetable_exceptions_user_id", "timetable_exceptions", ["user_id"])
	op.create_index("ix_timetable_exceptions_user_date", "timetable_exceptions", ["user_id", "exception_date"])

	# ── timetable ──────────────────────────────────────────────────────────
	op.drop_index("ix_timetable_course_day_start", table_name="timetable")
	op.add_column("timetable", sa.Column("user_id", sa.Integer(), nullable=True))
	op.execute(
		"""
		UPDATE timetable t
		SET user_id = (
			SELECT c.user_id FROM courses c WHERE c.id = t.course_id
		)
		"""
	)
	op.alter_column("timetable", "user_id", nullable=False)
	op.create_foreign_key(
		"timetable_user_id_fkey", "timetable", "users", ["user_id"], ["id"], ondelete="CASCADE"
	)
	op.create_index("ix_timetable_user_day_start", "timetable", ["user_id", "day", "start_time"])

	# ── attendance ─────────────────────────────────────────────────────────
	op.drop_index("ix_attendance_course_status_date", table_name="attendance")
	op.drop_index("ix_attendance_course_date", table_name="attendance")
	op.drop_constraint("ck_attendance_status", "attendance", type_="check")
	op.add_column("attendance", sa.Column("user_id", sa.Integer(), nullable=True))
	op.execute(
		"""
		UPDATE attendance a
		SET user_id = (
			SELECT c.user_id FROM courses c WHERE c.id = a.course_id
		)
		"""
	)
	op.alter_column("attendance", "user_id", nullable=False)
	op.create_foreign_key(
		"attendance_user_id_fkey", "attendance", "users", ["user_id"], ["id"], ondelete="CASCADE"
	)
	op.create_index("ix_attendance_user_date", "attendance", ["user_id", "date"])
	op.create_index("ix_attendance_user_status_date", "attendance", ["user_id", "status", "date"])
	op.create_check_constraint(
		"ck_attendance_status",
		"attendance",
		"status IN ('present', 'absent', 'holiday', 'exam')",
	)
