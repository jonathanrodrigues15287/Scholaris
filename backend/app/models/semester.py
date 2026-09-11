from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Semester(Base):
	__tablename__ = "semesters"
	__table_args__ = (Index("ix_semesters_user_number", "user_id", "semester_number"),)

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(80))
	semester_number: Mapped[int | None] = mapped_column(nullable=True)
	academic_year: Mapped[str] = mapped_column(String(20))
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

	user = relationship("User", back_populates="semesters")
	courses = relationship("Course", back_populates="semester")
