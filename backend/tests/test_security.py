from datetime import datetime, timedelta, timezone

import pytest

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
