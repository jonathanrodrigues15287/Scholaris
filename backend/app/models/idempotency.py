from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IdempotencyRecord(Base):
	__tablename__ = "idempotency_records"
	__table_args__ = (
		UniqueConstraint("user_id", "operation_id", name="uq_idempotency_user_operation"),
	)

	id: Mapped[int] = mapped_column(primary_key=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
	operation_id: Mapped[str] = mapped_column(String(128))
	request_hash: Mapped[str] = mapped_column(String(64))
	state: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
	response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
	response_body: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())