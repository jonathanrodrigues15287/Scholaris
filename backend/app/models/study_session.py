from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudySession(Base):
	__tablename__ = "study_sessions"

	id: Mapped[int] = mapped_column(primary_key=True)
	start_time: Mapped[datetime] = mapped_column(DateTime)
	duration: Mapped[int] = mapped_column(Integer)
	course_id: Mapped[int | None] = mapped_column(
		ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
	)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

	course = relationship("Course", back_populates="study_sessions")
	user = relationship("User", back_populates="study_sessions")
