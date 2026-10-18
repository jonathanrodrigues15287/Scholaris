from collections import OrderedDict, deque
from hashlib import sha256
from threading import Lock
from time import monotonic
from uuid import uuid4

from app.core.exceptions import RateLimitError

_WINDOW_SECONDS = 15 * 60
_MAX_FAILURES = 5
_MAX_LOCAL_IDENTIFIERS = 10_000
_REDIS_KEY_PREFIX = "scholaris:login-failures:"

_failures: OrderedDict[str, deque[float]] = OrderedDict()
_lock = Lock()
_redis_client = None
_redis_lock = Lock()

_CHECK_SCRIPT = """
local server_time = redis.call('TIME')
local now = tonumber(server_time[1]) * 1000 + math.floor(tonumber(server_time[2]) / 1000)
local cutoff = now - tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff)
local count = redis.call('ZCARD', KEYS[1])
redis.call('EXPIRE', KEYS[1], math.ceil(tonumber(ARGV[1]) / 1000))
if count >= tonumber(ARGV[2]) then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')[2]
    return {0, math.max(1, math.ceil((tonumber(ARGV[1]) - (now - tonumber(oldest))) / 1000))}
end
return {1, 0}
"""

_RECORD_SCRIPT = """
local server_time = redis.call('TIME')
local now = tonumber(server_time[1]) * 1000 + math.floor(tonumber(server_time[2]) / 1000)
redis.call('ZADD', KEYS[1], now, ARGV[1] .. ':' .. now)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - tonumber(ARGV[2]))
redis.call('EXPIRE', KEYS[1], math.ceil(tonumber(ARGV[2]) / 1000))
return 1
"""


def _production_redis():
	from app.core.config import settings

	if not settings.REDIS_URL:
		return None

	global _redis_client
	if _redis_client is None:
		with _redis_lock:
			if _redis_client is None:
				try:
					import redis
				except ImportError as error:
					raise RuntimeError("redis package is required for shared login rate limiting") from error
				_redis_client = redis.Redis.from_url(settings.REDIS_URL)
	return _redis_client


def _redis_key(identifier: str) -> str:
	identifier_hash = sha256(identifier.encode("utf-8")).hexdigest()
	return f"{_REDIS_KEY_PREFIX}{identifier_hash}"


def _check_redis_allowed(identifier: str, client) -> None:
	result = client.eval(
		_CHECK_SCRIPT,
		1,
		_redis_key(identifier),
		_WINDOW_SECONDS * 1000,
		_MAX_FAILURES,
	)
	if int(result[0]) == 0:
		raise RateLimitError("Too many login attempts", int(result[1]))


def _record_redis_failure(identifier: str, client) -> None:
	client.eval(
		_RECORD_SCRIPT,
		1,
		_redis_key(identifier),
		uuid4().hex,
		_WINDOW_SECONDS * 1000,
	)


def check_login_allowed(identifier: str) -> None:
	client = _production_redis()
	if client is not None:
		_check_redis_allowed(identifier, client)
		return

	now = monotonic()
	with _lock:
		attempts = _failures.get(identifier)
		if attempts is None:
			return
		while attempts and now - attempts[0] >= _WINDOW_SECONDS:
			attempts.popleft()
		if not attempts:
			_failures.pop(identifier, None)
			return
		_failures.move_to_end(identifier)
		if len(attempts) >= _MAX_FAILURES:
			retry_after = max(1, int(_WINDOW_SECONDS - (now - attempts[0])))
			raise RateLimitError("Too many login attempts", retry_after)


def record_login_failure(identifier: str) -> None:
	client = _production_redis()
	if client is not None:
		_record_redis_failure(identifier, client)
		return

	with _lock:
		attempts = _failures.setdefault(identifier, deque())
		attempts.append(monotonic())
		_failures.move_to_end(identifier)
		while len(_failures) > _MAX_LOCAL_IDENTIFIERS:
			_failures.popitem(last=False)


def clear_login_failures(identifier: str) -> None:
	client = _production_redis()
	if client is not None:
		client.delete(_redis_key(identifier))
		return

	with _lock:
		_failures.pop(identifier, None)
