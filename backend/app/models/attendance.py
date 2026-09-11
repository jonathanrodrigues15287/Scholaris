from datetime import date as date_type

from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Attendance(Base):
	__tablename__ = "attendance"
	__table_args__ = (
		UniqueConstraint("user_id", "course_id", "date", name="uq_attendance_user_course_date"),
		Index("ix_attendance_user_date", "user_id", "date"),
		Index("ix_attendance_user_status_date", "user_id", "status", "date"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	date: Mapped[date_type] = mapped_column(Date)
	status: Mapped[str] = mapped_column(String(10))
	semester_id: Mapped[int | None] = mapped_column(
		ForeignKey("semesters.id", ondelete="SET NULL"), nullable=True, index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc)
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

	course = relationship("Course", back_populates="attendance_records")
	semester = relationship("Semester")
	user = relationship("User", back_populates="attendance_records")


class AttendanceHistory(Base):
	__tablename__ = "attendance_history"
	__table_args__ = (Index("ix_attendance_history_user_created", "user_id", "created_at"),)

	id: Mapped[int] = mapped_column(primary_key=True)
	attendance_id: Mapped[int | None] = mapped_column(
		ForeignKey("attendance.id", ondelete="SET NULL"), nullable=True, index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	semester_id: Mapped[int | None] = mapped_column(nullable=True)
	date: Mapped[date_type] = mapped_column(Date)
	event: Mapped[str] = mapped_column(String(20))
	from_status: Mapped[str | None] = mapped_column(String(10), nullable=True)
	to_status: Mapped[str | None] = mapped_column(String(10), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
