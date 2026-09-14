"""Expand timetable scheduling and exceptions.

Revision ID: 0006_timetable_scheduling
Revises: 0005_attendance_analytics
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_timetable_scheduling"
down_revision = "0005_attendance_analytics"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("timetable", sa.Column("faculty", sa.String(length=120), nullable=True))
	op.add_column("timetable", sa.Column("recurrence_rule", sa.String(length=20), nullable=True))
	op.add_column("timetable", sa.Column("recurrence_until", sa.Date(), nullable=True))
	op.add_column("timetable", sa.Column("semester_id", sa.Integer(), nullable=True))
	op.create_foreign_key(
		"fk_timetable_semester_id",
		"timetable",
		"semesters",
		["semester_id"],
		["id"],
		ondelete="SET NULL",
	)
	op.create_index("ix_timetable_semester_id", "timetable", ["semester_id"])
	op.create_check_constraint(
		"ck_timetable_recurrence_rule",
		"timetable",
		"recurrence_rule IS NULL OR recurrence_rule = 'weekly'",
	)
	op.create_table(
		"timetable_exceptions",
		sa.Column("id", sa.Integer(), nullable=False),
		sa.Column("timetable_id", sa.Integer(), nullable=False),
		sa.Column("user_id", sa.Integer(), nullable=False),
		sa.Column("exception_date", sa.Date(), nullable=False),
		sa.Column("status", sa.String(length=20), nullable=False),
		sa.Column("note", sa.String(length=255), nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
		sa.ForeignKeyConstraint(["timetable_id"], ["timetable.id"], ondelete="CASCADE"),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("timetable_id", "exception_date", name="uq_timetable_exception_date"),
	)
	op.create_index("ix_timetable_exceptions_timetable_id", "timetable_exceptions", ["timetable_id"])
	op.create_index("ix_timetable_exceptions_user_id", "timetable_exceptions", ["user_id"])
	op.create_index("ix_timetable_exceptions_user_date", "timetable_exceptions", ["user_id", "exception_date"])


def downgrade() -> None:
	op.drop_index("ix_timetable_exceptions_user_date", table_name="timetable_exceptions")
	op.drop_index("ix_timetable_exceptions_user_id", table_name="timetable_exceptions")
	op.drop_index("ix_timetable_exceptions_timetable_id", table_name="timetable_exceptions")
	op.drop_table("timetable_exceptions")
	op.drop_constraint("ck_timetable_recurrence_rule", "timetable", type_="check")
	op.drop_index("ix_timetable_semester_id", table_name="timetable")
	op.drop_constraint("fk_timetable_semester_id", "timetable", type_="foreignkey")
	for column in ("semester_id", "recurrence_until", "recurrence_rule", "faculty"):
		op.drop_column(column, table_name="timetable")
