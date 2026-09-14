"""Create the initial Scholaris schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_table(
		"users",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("name", sa.String(length=120), nullable=False),
		sa.Column("email", sa.String(length=320), nullable=False),
		sa.Column("hashed_password", sa.String(length=255), nullable=False),
		sa.Column("is_active", sa.Boolean(), nullable=False),
		sa.Column("created_at", sa.DateTime(), nullable=False),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("email"),
	)
	op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

	op.create_table(
		"courses",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("name", sa.String(length=120), nullable=False),
		sa.Column("code", sa.String(length=30), nullable=False),
		sa.Column("credits", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_courses_user_id"), "courses", ["user_id"], unique=False)

	op.create_table(
		"assignments",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("title", sa.String(length=200), nullable=False),
		sa.Column("description", sa.String(length=2000), nullable=True),
		sa.Column("due_date", sa.Date(), nullable=True),
		sa.Column("priority", sa.String(length=10), nullable=False),
		sa.Column("status", sa.String(length=20), nullable=False),
		sa.Column("priority_mode", sa.String(length=10), nullable=False),
		sa.Column("is_completed", sa.Boolean(), nullable=False),
		sa.Column("is_submitted", sa.Boolean(), nullable=False),
		sa.Column("course_id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("created_at", sa.DateTime(), nullable=False),
		sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_assignments_course_id"), "assignments", ["course_id"], unique=False)
	op.create_index(op.f("ix_assignments_user_id"), "assignments", ["user_id"], unique=False)

	op.create_table(
		"semesters",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("name", sa.String(length=80), nullable=False),
		sa.Column("semester_number", sa.Integer(), nullable=True),
		sa.Column("academic_year", sa.String(length=20), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_semesters_user_id"), "semesters", ["user_id"], unique=False)

	op.create_table(
		"attendance",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("course_id", sa.Integer(), nullable=False),
		sa.Column("date", sa.Date(), nullable=False),
		sa.Column("status", sa.String(length=10), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_attendance_course_id"), "attendance", ["course_id"], unique=False)
	op.create_index(op.f("ix_attendance_user_id"), "attendance", ["user_id"], unique=False)

	op.create_table(
		"study_sessions",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("start_time", sa.DateTime(), nullable=False),
		sa.Column("duration", sa.Integer(), nullable=False),
		sa.Column("course_id", sa.Integer(), nullable=True),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_study_sessions_course_id"), "study_sessions", ["course_id"], unique=False)
	op.create_index(op.f("ix_study_sessions_user_id"), "study_sessions", ["user_id"], unique=False)

	op.create_table(
		"timetable",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("day", sa.String(length=15), nullable=False),
		sa.Column("start_time", sa.Time(), nullable=False),
		sa.Column("end_time", sa.Time(), nullable=False),
		sa.Column("room", sa.String(length=80), nullable=True),
		sa.Column("course_id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
	)
	op.create_index(op.f("ix_timetable_course_id"), "timetable", ["course_id"], unique=False)
	op.create_index(op.f("ix_timetable_user_id"), "timetable", ["user_id"], unique=False)


def downgrade() -> None:
	op.drop_index(op.f("ix_timetable_user_id"), table_name="timetable")
	op.drop_index(op.f("ix_timetable_course_id"), table_name="timetable")
	op.drop_table("timetable")
	op.drop_index(op.f("ix_study_sessions_user_id"), table_name="study_sessions")
	op.drop_index(op.f("ix_study_sessions_course_id"), table_name="study_sessions")
	op.drop_table("study_sessions")
	op.drop_index(op.f("ix_attendance_user_id"), table_name="attendance")
	op.drop_index(op.f("ix_attendance_course_id"), table_name="attendance")
	op.drop_table("attendance")
	op.drop_index(op.f("ix_semesters_user_id"), table_name="semesters")
	op.drop_table("semesters")
	op.drop_index(op.f("ix_assignments_user_id"), table_name="assignments")
	op.drop_index(op.f("ix_assignments_course_id"), table_name="assignments")
	op.drop_table("assignments")
	op.drop_index(op.f("ix_courses_user_id"), table_name="courses")
	op.drop_table("courses")
	op.drop_index(op.f("ix_users_email"), table_name="users")
	op.drop_table("users")
