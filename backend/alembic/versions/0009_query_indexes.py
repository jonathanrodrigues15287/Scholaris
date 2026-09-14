"""Add indexes for dashboard and high-volume list queries.

Revision ID: 0009_query_indexes
Revises: 0008_study_tracking
Create Date: 2026-09-10
"""

from alembic import op


revision = "0009_query_indexes"
down_revision = "0008_study_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_index("ix_assignments_user_active_due", "assignments", ["user_id", "deleted_at", "due_date"])
	op.create_index("ix_attendance_user_status_date", "attendance", ["user_id", "status", "date"])
	op.create_index("ix_study_sessions_user_course_start", "study_sessions", ["user_id", "course_id", "start_time"])
	op.create_index("ix_study_sessions_user_assignment_start", "study_sessions", ["user_id", "assignment_id", "start_time"])
	op.create_index("ix_semesters_user_number", "semesters", ["user_id", "semester_number"])
	op.create_index("ix_courses_user_semester", "courses", ["user_id", "semester_id"])


def downgrade() -> None:
	op.drop_index("ix_courses_user_semester", table_name="courses")
	op.drop_index("ix_semesters_user_number", table_name="semesters")
	op.drop_index("ix_study_sessions_user_assignment_start", table_name="study_sessions")
	op.drop_index("ix_study_sessions_user_course_start", table_name="study_sessions")
	op.drop_index("ix_attendance_user_status_date", table_name="attendance")
	op.drop_index("ix_assignments_user_active_due", table_name="assignments")
