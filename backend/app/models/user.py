from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
	__tablename__ = "users"

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(120))
	email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
	hashed_password: Mapped[str] = mapped_column(String(255))
	is_active: Mapped[bool] = mapped_column(Boolean, default=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

	courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
	assignments = relationship("Assignment", back_populates="user", cascade="all, delete-orphan")
	semesters = relationship("Semester", back_populates="user", cascade="all, delete-orphan")
	timetable_entries = relationship("Timetable", back_populates="user", cascade="all, delete-orphan")
	attendance_records = relationship("Attendance", back_populates="user", cascade="all, delete-orphan")
	study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
