import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
	salt = os.urandom(16)
	digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
	return "scrypt$%s$%s" % (
		base64.urlsafe_b64encode(salt).decode(),
		base64.urlsafe_b64encode(digest).decode(),
	)


def verify_password(password: str, encoded_password: str) -> bool:
	try:
		scheme, salt_value, digest_value = encoded_password.split("$", 2)
		if scheme != "scrypt":
			return False
		salt = base64.urlsafe_b64decode(salt_value.encode())
		expected = base64.urlsafe_b64decode(digest_value.encode())
		actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
		return hmac.compare_digest(actual, expected)
	except (ValueError, TypeError):
		return False


def create_access_token(subject: str) -> str:
	return _create_token(subject, "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(
	subject: str,
	jti: str | None = None,
	expires_at: datetime | None = None,
) -> str:
	return _create_token(
		subject,
		"refresh",
		timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
		jti=jti or uuid4().hex,
		expires_at=expires_at,
	)


def _create_token(
	subject: str,
	token_type: str,
	lifetime: timedelta,
	*,
	jti: str | None = None,
	expires_at: datetime | None = None,
) -> str:
	token_expires_at = expires_at or datetime.now(timezone.utc) + lifetime
	payload: dict[str, Any] = {"sub": subject, "type": token_type, "exp": token_expires_at}
	if jti is not None:
		payload["jti"] = jti
	return jwt.encode(
		payload,
		settings.JWT_SECRET_KEY.get_secret_value(),
		algorithm=settings.JWT_ALGORITHM,
	)


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
	payload = jwt.decode(
		token,
		settings.JWT_SECRET_KEY.get_secret_value(),
		algorithms=[settings.JWT_ALGORITHM],
	)
	if payload.get("type") != expected_type:
		raise ValueError("Invalid token type")
	return payload


def decode_token(token: str, expected_type: str = "access") -> str:
	payload = _decode_token(token, expected_type)
	subject = payload.get("sub")
	if not subject:
		raise ValueError("Token subject is missing")
	return str(subject)


def decode_refresh_token(token: str) -> tuple[str, str]:
	payload = _decode_token(token, "refresh")
	subject = payload.get("sub")
	jti = payload.get("jti")
	if not subject:
		raise ValueError("Token subject is missing")
	if not isinstance(jti, str) or not jti:
		raise ValueError("Refresh token ID is missing")
	return str(subject), jti


def decode_access_token(token: str) -> str:
	return decode_token(token, "access")
