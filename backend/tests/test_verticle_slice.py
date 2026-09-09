import os

os.environ["DATABASE_URL"] = "sqlite:///./test_scholaris.db"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient

from app.main import app


def test_user_login_course_assignment_fetch():
    email = "student@example.com"
    password = "correct-horse-battery-staple"

    with TestClient(app) as client:
        register_response = client.post(
            "/auth/register",
            json={"email": email, "full_name": "Test Student", "password": password},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        course_response = client.post(
            "/courses",
            json={"name": "Data Structures", "code": "CSE201"},
            headers=headers,
        )
        assert course_response.status_code == 201
        course = course_response.json()

        assignment_response = client.post(
            "/assignments",
            json={
                "title": "Implement a linked list",
                "due_date": "2026-09-20",
                "priority": "high",
                "course_id": course["id"],
            },
            headers=headers,
        )
        assert assignment_response.status_code == 201

        fetch_response = client.get("/assignments", headers=headers)
        assert fetch_response.status_code == 200
        assert fetch_response.json()[0]["title"] == "Implement a linked list"
        assert fetch_response.json()[0]["course_id"] == course["id"]
