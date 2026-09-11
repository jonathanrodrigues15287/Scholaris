from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
	__tablename__ = "users"

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(120))
	email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
	hashed_password: Mapped[str] = mapped_column(String(255))
	is_active: Mapped[bool] = mapped_column(Boolean, default=True)
	minimum_attendance_threshold: Mapped[float] = mapped_column(Float, default=75.0)
	weekly_study_goal_minutes: Mapped[int] = mapped_column(default=300)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

	courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
	assignments = relationship("Assignment", back_populates="user", cascade="all, delete-orphan")
	semesters = relationship("Semester", back_populates="user", cascade="all, delete-orphan")
	timetable_entries = relationship("Timetable", back_populates="user", cascade="all, delete-orphan")
	attendance_records = relationship("Attendance", back_populates="user", cascade="all, delete-orphan")
	study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
