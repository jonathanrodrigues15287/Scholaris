from datetime import time

from sqlalchemy import ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Timetable(Base):
	__tablename__ = "timetable"

	id: Mapped[int] = mapped_column(primary_key=True)
	day: Mapped[str] = mapped_column(String(15))
	start_time: Mapped[time] = mapped_column(Time)
	end_time: Mapped[time] = mapped_column(Time)
	room: Mapped[str | None] = mapped_column(String(80), nullable=True)
	course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

	course = relationship("Course", back_populates="timetable_entries")
	user = relationship("User", back_populates="timetable_entries")
