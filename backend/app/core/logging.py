from __future__ import annotations

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
from typing import Any


_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(request_id: str):
	return _request_id.set(request_id)


def reset_request_id(token) -> None:
	_request_id.reset(token)


def current_request_id() -> str | None:
	return _request_id.get()


def log_event(logger: logging.Logger, level: int, event: str, *, exc_info: Any = None, **fields: Any) -> None:
	record = {
		"timestamp": datetime.now(timezone.utc).isoformat(),
		"level": logging.getLevelName(level),
		"event": event,
		**({"request_id": request_id} if (request_id := current_request_id()) else {}),
		**{key: value for key, value in fields.items() if value is not None},
	}
	logger.log(level, json.dumps(record, default=str, separators=(",", ":")), exc_info=exc_info)
