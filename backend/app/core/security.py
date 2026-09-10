import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

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


def create_refresh_token(subject: str) -> str:
	return _create_token(subject, "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def _create_token(subject: str, token_type: str, lifetime: timedelta) -> str:
	expires_at = datetime.now(timezone.utc) + lifetime
	return jwt.encode(
		{"sub": subject, "type": token_type, "exp": expires_at},
		settings.JWT_SECRET_KEY.get_secret_value(),
		algorithm=settings.JWT_ALGORITHM,
	)


def decode_token(token: str, expected_type: str = "access") -> str:
	payload = jwt.decode(
		token,
		settings.JWT_SECRET_KEY.get_secret_value(),
		algorithms=[settings.JWT_ALGORITHM],
	)
	if payload.get("type") != expected_type:
		raise ValueError("Invalid token type")
	subject = payload.get("sub")
	if not subject:
		raise ValueError("Token subject is missing")
	return str(subject)


def decode_access_token(token: str) -> str:
	return decode_token(token, "access")
