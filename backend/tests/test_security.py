from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


def test_password_hash_verifies_only_the_original_password():
    encoded = hash_password("CorrectPassword1!")

    assert encoded.startswith("scrypt$")
    assert verify_password("CorrectPassword1!", encoded)
    assert not verify_password("IncorrectPassword1!", encoded)


def test_access_token_round_trip_preserves_subject():
    token = create_access_token("42")

    assert decode_access_token(token) == "42"


def test_refresh_token_round_trip_preserves_subject_and_jti():
    token = create_refresh_token(
        "42",
        jti="refresh-token-id",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )

    assert decode_refresh_token(token) == ("42", "refresh-token-id")


def test_access_decoder_rejects_refresh_tokens():
    token = create_refresh_token("42", jti="refresh-token-id")

    with pytest.raises(ValueError, match="Invalid token type"):
        decode_access_token(token)


def test_refresh_decoder_rejects_access_tokens():
    token = create_access_token("42")

    with pytest.raises(ValueError, match="Invalid token type"):
        decode_refresh_token(token)


def test_expired_access_token_is_rejected():
    token = jwt.encode(
        {
            "sub": "42",
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_tampered_token_is_rejected():
    token = create_access_token("42")
    tampered = f"{token[:-1]}{'a' if token[-1] != 'a' else 'b'}"

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(tampered)


def test_token_signed_with_wrong_secret_is_rejected():
    token = jwt.encode(
        {"sub": "42", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "different-secret-key-with-at-least-32-characters",
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)
