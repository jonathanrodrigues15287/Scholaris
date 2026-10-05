from uuid import uuid4


def test_register_login_and_get_current_user(api_client):
    email = f"auth-user-{uuid4().hex}@example.com"
    password = "Correct-horse-battery-1!"

    registered = api_client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Auth User", "password": password},
    )
    assert registered.status_code == 201
    assert registered.json()["email"] == email

    logged_in = api_client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert logged_in.status_code == 200
    assert logged_in.json()["authenticated"] is True

    current_user = api_client.get("/api/v1/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["email"] == email


def test_login_rejects_invalid_password(api_client):
    email = f"invalid-password-{uuid4().hex}@example.com"
    assert api_client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Auth User", "password": "Correct-horse-battery-1!"},
    ).status_code == 201

    response = api_client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Wrong-password-1!"},
    )
    assert response.status_code == 401


def test_refresh_rotates_and_revokes_previous_token(api_client):
    email = f"refresh-{uuid4().hex}@example.com"
    password = "Correct-horse-battery-1!"
    assert api_client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Refresh User", "password": password},
    ).status_code == 201
    assert api_client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    ).status_code == 200

    csrf_token = api_client.cookies.get("csrf_token")
    original_refresh_token = api_client.cookies.get("refresh_token")
    refreshed = api_client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert refreshed.status_code == 200
    rotated_refresh_token = api_client.cookies.get("refresh_token")
    assert rotated_refresh_token != original_refresh_token

    api_client.cookies.set("refresh_token", original_refresh_token)
    reused = api_client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert reused.status_code == 401
