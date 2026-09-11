from datetime import date, datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Assignment(Base):
	__tablename__ = "assignments"
	__table_args__ = (
		CheckConstraint(
			"status IN ('pending', 'in_progress', 'completed', 'submitted')",
			name="ck_assignments_status",
		),
		CheckConstraint(
			"is_completed = (status IN ('completed', 'submitted'))",
			name="ck_assignments_completed_projection",
		),
		CheckConstraint(
			"is_submitted = (status = 'submitted')",
			name="ck_assignments_submitted_projection",
		),
		Index("ix_assignments_user_status_due", "user_id", "status", "due_date"),
		Index("ix_assignments_user_active_due", "user_id", "deleted_at", "due_date"),
		CheckConstraint("priority IN ('high', 'medium', 'low')", name="ck_assignments_priority"),
		CheckConstraint("priority_mode IN ('manual', 'auto')", name="ck_assignments_priority_mode"),
		CheckConstraint(
			"recurrence_rule IS NULL OR due_date IS NOT NULL",
			name="ck_assignments_recurrence_requires_due_date",
		),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	title: Mapped[str] = mapped_column(String(200))
	description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
	due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	priority: Mapped[str] = mapped_column(String(10), default="medium")
	status: Mapped[str] = mapped_column(String(20), default="pending")
	priority_mode: Mapped[str] = mapped_column(String(10), default="manual")
	is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
	is_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
	recurrence_rule: Mapped[str | None] = mapped_column(String(40), nullable=True)
	recurrence_until: Mapped[date | None] = mapped_column(Date, nullable=True)
	reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
	attachment_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)
	completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

	course = relationship("Course", back_populates="assignments")
	user = relationship("User", back_populates="assignments")
	history = relationship("AssignmentHistory", back_populates="assignment", cascade="all, delete-orphan")
	study_sessions = relationship("StudySession", back_populates="assignment")


class AssignmentHistory(Base):
	__tablename__ = "assignment_history"
	__table_args__ = (Index("ix_assignment_history_assignment_created", "assignment_id", "created_at"),)

	id: Mapped[int] = mapped_column(primary_key=True)
	assignment_id: Mapped[int] = mapped_column(
		ForeignKey("assignments.id", ondelete="CASCADE"), index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	event: Mapped[str] = mapped_column(String(30))
	from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
	to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

	assignment = relationship("Assignment", back_populates="history")
	user = relationship("User")
