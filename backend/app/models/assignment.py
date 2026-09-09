from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Assignment(Base):
	__tablename__ = "assignments"

	id: Mapped[int] = mapped_column(primary_key=True)
	title: Mapped[str] = mapped_column(String(200))
	description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
	due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	priority: Mapped[str] = mapped_column(String(10), default="medium")
	status: Mapped[str] = mapped_column(String(20), default="pending")
	priority_mode: Mapped[str] = mapped_column(String(10), default="manual")
	is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
	is_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

	course = relationship("Course", back_populates="assignments")
	user = relationship("User", back_populates="assignments")
