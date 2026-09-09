from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Course(Base):
	__tablename__ = "courses"

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(120))
	code: Mapped[str] = mapped_column(String(30))
	credits: Mapped[int] = mapped_column(default=0)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

	user = relationship("User", back_populates="courses")
	assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
	timetable_entries = relationship("Timetable", back_populates="course", cascade="all, delete-orphan")
	attendance_records = relationship("Attendance", back_populates="course", cascade="all, delete-orphan")
	study_sessions = relationship("StudySession", back_populates="course")
