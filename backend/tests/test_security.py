from uuid import uuid4

from fastapi.testclient import TestClient


def test_protected_api_requires_authentication(api_client):
    response = api_client.get("/api/v1/courses")
    assert response.status_code == 401


def test_user_cannot_read_or_delete_another_users_resources(api_client, auth_headers):
    other_client = TestClient(api_client.app)
    with other_client:
        other_email = f"security-other-{uuid4().hex}@example.com"
        password = "Correct-horse-battery-1!"
        assert other_client.post(
            "/api/v1/auth/register",
            json={"email": other_email, "name": "Other User", "password": password},
        ).status_code == 201
        assert other_client.post(
            "/api/v1/auth/login",
            data={"username": other_email, "password": password},
        ).status_code == 200
        other_headers = {"X-CSRF-Token": other_client.cookies.get("csrf_token")}

        course = api_client.post(
            "/api/v1/courses",
            json={"name": "Private Course", "code": "SEC401"},
            headers=auth_headers,
        ).json()
        assert other_client.get(f"/api/v1/courses/{course['id']}", headers=other_headers).status_code == 404
        assert other_client.delete(f"/api/v1/courses/{course['id']}", headers=other_headers).status_code == 404
