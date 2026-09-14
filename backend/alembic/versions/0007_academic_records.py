"""Persist academic grades on semester-linked courses.

Revision ID: 0007_academic_records
Revises: 0006_timetable_scheduling
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_academic_records"
down_revision = "0006_timetable_scheduling"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("courses", sa.Column("grade", sa.Float(), nullable=True))
	op.add_column("courses", sa.Column("semester_id", sa.Integer(), nullable=True))
	op.create_foreign_key(
		"fk_courses_semester_id",
		"courses",
		"semesters",
		["semester_id"],
		["id"],
		ondelete="SET NULL",
	)
	op.create_index("ix_courses_semester_id", "courses", ["semester_id"])
	op.create_check_constraint("ck_courses_credits_nonnegative", "courses", "credits >= 0")
	op.create_check_constraint("ck_courses_grade_range", "courses", "grade IS NULL OR (grade >= 0 AND grade <= 10)")


def downgrade() -> None:
	op.drop_constraint("ck_courses_grade_range", "courses", type_="check")
	op.drop_constraint("ck_courses_credits_nonnegative", "courses", type_="check")
	op.drop_index("ix_courses_semester_id", table_name="courses")
	op.drop_constraint("fk_courses_semester_id", "courses", type_="foreignkey")
	op.drop_column("semester_id", table_name="courses")
	op.drop_column("grade", table_name="courses")
