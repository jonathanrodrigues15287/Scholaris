from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from app.core.exceptions import RateLimitError

_WINDOW_SECONDS = 15 * 60
_MAX_FAILURES = 5
_failures: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def check_login_allowed(identifier: str) -> None:
	now = monotonic()
	with _lock:
		attempts = _failures[identifier]
		while attempts and now - attempts[0] >= _WINDOW_SECONDS:
			attempts.popleft()
		if len(attempts) >= _MAX_FAILURES:
			retry_after = max(1, int(_WINDOW_SECONDS - (now - attempts[0])))
			raise RateLimitError("Too many login attempts", retry_after)


def record_login_failure(identifier: str) -> None:
	with _lock:
		_failures[identifier].append(monotonic())


def clear_login_failures(identifier: str) -> None:
	with _lock:
		_failures.pop(identifier, None)
