from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudySession(Base):
	__tablename__ = "study_sessions"
	__table_args__ = (
		Index("ix_study_sessions_user_start", "user_id", "start_time"),
		Index("ix_study_sessions_user_course_start", "user_id", "course_id", "start_time"),
		Index("ix_study_sessions_user_assignment_start", "user_id", "assignment_id", "start_time"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	start_time: Mapped[datetime] = mapped_column(DateTime)
	duration: Mapped[int] = mapped_column(Integer)
	course_id: Mapped[int | None] = mapped_column(
		ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
	)
	assignment_id: Mapped[int | None] = mapped_column(
		ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True, index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

	course = relationship("Course", back_populates="study_sessions")
	assignment = relationship("Assignment", back_populates="study_sessions")
	user = relationship("User", back_populates="study_sessions")
