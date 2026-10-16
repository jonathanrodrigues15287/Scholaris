from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RefreshToken(Base):
	__tablename__ = "refresh_tokens"
	__table_args__ = (
		Index("ix_refresh_tokens_token_hash", "token_hash", unique=True),
		Index("ix_refresh_tokens_user_id", "user_id"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
	token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
	expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
	)
	revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
	replaced_by: Mapped[int | None] = mapped_column(ForeignKey("refresh_tokens.id"))

	user = relationship("User", back_populates="refresh_tokens")
