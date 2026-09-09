from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Semester(Base):
	__tablename__ = "semesters"

	id: Mapped[int] = mapped_column(primary_key=True)
	name: Mapped[str] = mapped_column(String(80))
	semester_number: Mapped[int | None] = mapped_column(nullable=True)
	academic_year: Mapped[str] = mapped_column(String(20))
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

	user = relationship("User", back_populates="semesters")
