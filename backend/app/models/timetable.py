from datetime import date, time

from datetime import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Timetable(Base):
	__tablename__ = "timetable"
	__table_args__ = (Index("ix_timetable_user_day_start", "user_id", "day", "start_time"),)

	id: Mapped[int] = mapped_column(primary_key=True)
	day: Mapped[str] = mapped_column(String(15))
	start_time: Mapped[time] = mapped_column(Time)
	end_time: Mapped[time] = mapped_column(Time)
	room: Mapped[str | None] = mapped_column(String(80), nullable=True)
	faculty: Mapped[str | None] = mapped_column(String(120), nullable=True)
	recurrence_rule: Mapped[str | None] = mapped_column(String(20), nullable=True)
	recurrence_until: Mapped[date | None] = mapped_column(Date, nullable=True)
	semester_id: Mapped[int | None] = mapped_column(
		ForeignKey("semesters.id", ondelete="SET NULL"), nullable=True, index=True
	)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

	course = relationship("Course", back_populates="timetable_entries")
	user = relationship("User", back_populates="timetable_entries")
	semester = relationship("Semester")
	exceptions = relationship("TimetableException", back_populates="timetable", cascade="all, delete-orphan")


class TimetableException(Base):
	__tablename__ = "timetable_exceptions"
	__table_args__ = (
		UniqueConstraint("timetable_id", "exception_date", name="uq_timetable_exception_date"),
		Index("ix_timetable_exceptions_user_date", "user_id", "exception_date"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	timetable_id: Mapped[int] = mapped_column(
		ForeignKey("timetable.id", ondelete="CASCADE"), index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	exception_date: Mapped[date] = mapped_column(Date)
	status: Mapped[str] = mapped_column(String(20), default="cancelled")
	note: Mapped[str | None] = mapped_column(String(255), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

	timetable = relationship("Timetable", back_populates="exceptions")
