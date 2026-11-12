from app.core import rate_limit


def test_repeated_failed_logins_are_rate_limited(client):
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "username": "rate-limited",
            "email": "rate@example.com",
            "name": "Rate Limited",
            "password": "StrongPassword1!",
        },
    )
    assert registered.status_code == 201

    rate_limit._failures.clear()
    for _ in range(5):
        failed_login = client.post(
            "/api/v1/auth/login",
            data={"username": "rate-limited", "password": "WrongPassword1!"},
        )
        assert failed_login.status_code == 401

    limited_login = client.post(
        "/api/v1/auth/login",
        data={"username": "rate-limited", "password": "WrongPassword1!"},
    )

    assert limited_login.status_code == 429
    assert limited_login.json()["code"] == "RATELIMIT"
    assert int(limited_login.headers["Retry-After"]) > 0
    rate_limit._failures.clear()
