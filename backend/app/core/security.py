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
	expires_at = datetime.now(timezone.utc) + timedelta(
		minutes=settings.access_token_expire_minutes
	)
	return jwt.encode(
		{"sub": subject, "exp": expires_at},
		settings.jwt_secret_key,
		algorithm=settings.jwt_algorithm,
	)


def decode_access_token(token: str) -> str:
	payload = jwt.decode(
		token,
		settings.jwt_secret_key,
		algorithms=[settings.jwt_algorithm],
	)
	subject = payload.get("sub")
	if not subject:
		raise ValueError("Token subject is missing")
	return str(subject)
