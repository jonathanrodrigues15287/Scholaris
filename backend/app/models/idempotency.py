from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Course(Base):
	__tablename__ = "courses"
	__table_args__ = (
		Index("ix_courses_user_name", "user_id", "name"),
		Index("ix_courses_user_semester", "user_id", "semester_id"),
		CheckConstraint("credits >= 0", name="ck_courses_credits_nonnegative"),
		CheckConstraint("grade IS NULL OR (grade >= 0 AND grade <= 10)", name="ck_courses_grade_range"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(120))
	code: Mapped[str] = mapped_column(String(30))
	credits: Mapped[int] = mapped_column(default=0)
	grade: Mapped[float | None] = mapped_column(nullable=True)
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
	deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

	user = relationship("User", back_populates="courses")
	semester = relationship("Semester", back_populates="courses")
	assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
	timetable_entries = relationship("Timetable", back_populates="course", cascade="all, delete-orphan")
	attendance_records = relationship("Attendance", back_populates="course", cascade="all, delete-orphan")
	study_sessions = relationship("StudySession", back_populates="course")
