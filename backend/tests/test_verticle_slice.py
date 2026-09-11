import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config

test_database_url = os.environ.get("TEST_DATABASE_URL")
if not test_database_url:
    pytest.skip(
        "Set TEST_DATABASE_URL to run PostgreSQL integration tests",
        allow_module_level=True,
    )
os.environ["DATABASE_URL"] = test_database_url
os.environ["JWT_SECRET_KEY"] = "test-secret-key-with-at-least-32-characters"

from fastapi.testclient import TestClient

from app.main import app


alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
command.upgrade(alembic_config, "head")


def test_user_login_course_assignment_fetch():
    email = f"student-{uuid4().hex}@example.com"
    password = "Correct-horse-battery-1!"

    with TestClient(app) as client:
        register_response = client.post(
            "/api/v1/auth/register",
            json={"email": email, "full_name": "Test Student", "password": password},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200
        assert login_response.json()["authenticated"] is True
        csrf_token = client.cookies.get("csrf_token")
        headers = {"X-CSRF-Token": csrf_token}

        course_response = client.post(
            "/api/v1/courses",
            json={"name": "Data Structures", "code": "CSE201"},
            headers=headers,
        )
        assert course_response.status_code == 201
        course = course_response.json()

        assignment_response = client.post(
            "/api/v1/assignments",
            json={
                "title": "Implement a linked list",
                "due_date": "2026-09-20",
                "priority": "high",
                "course_id": course["id"],
            },
            headers=headers,
        )
        assert assignment_response.status_code == 201

        fetch_response = client.get("/api/v1/assignments", headers=headers)
        assert fetch_response.status_code == 200
        assert fetch_response.json()["items"][0]["title"] == "Implement a linked list"
        assert fetch_response.json()["items"][0]["course_id"] == course["id"]


def _register_and_login(client: TestClient, label: str) -> dict[str, str]:
    email = f"{label}-{uuid4().hex}@example.com"
    password = "Correct-horse-battery-1!"
    assert client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": label, "password": password},
    ).status_code == 201
    assert client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    ).status_code == 200
    return {"X-CSRF-Token": client.cookies.get("csrf_token")}


def test_user_cannot_access_or_mutate_another_users_resources():
    with TestClient(app) as owner, TestClient(app) as other:
        owner_headers = _register_and_login(owner, "owner")
        other_headers = _register_and_login(other, "other")

        course_response = owner.post(
            "/api/v1/courses",
            json={"name": "Algorithms", "code": "CSE301"},
            headers=owner_headers,
        )
        course_id = course_response.json()["id"]
        assignment_id = owner.post(
            "/api/v1/assignments",
            json={"title": "Graph proof", "course_id": course_id},
            headers=owner_headers,
        ).json()["id"]
        attendance_id = owner.post(
            "/api/v1/attendance",
            json={"course_id": course_id, "date": "2026-09-09", "status": "present"},
            headers=owner_headers,
        ).json()["id"]
        timetable_id = owner.post(
            "/api/v1/timetable",
            json={
                "day": "Wednesday",
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "course_id": course_id,
            },
            headers=owner_headers,
        ).json()["id"]
        study_id = owner.post(
            "/api/v1/study/sessions",
            json={
                "start_time": "2026-09-09T10:00:00Z",
                "duration": 1500,
                "course_id": course_id,
            },
            headers=owner_headers,
        ).json()["id"]

        protected_resources = (
            (f"/api/v1/courses/{course_id}", {"name": "Stolen", "code": "OWN"}),
            (f"/api/v1/assignments/{assignment_id}", {"title": "Stolen"}),
            (f"/api/v1/attendance/{attendance_id}", {"status": "absent"}),
            (f"/api/v1/timetable/{timetable_id}", {"room": "Stolen"}),
            (f"/api/v1/study/sessions/{study_id}", {"duration": 999}),
        )
        for path, update in protected_resources:
            assert other.get(path).status_code == 404
            assert other.patch(path, json=update, headers=other_headers).status_code == 404
            assert other.delete(path, headers=other_headers).status_code == 404

        assert other.post(
            "/api/v1/attendance",
            json={"course_id": course_id, "date": "2026-09-10", "status": "present"},
            headers=other_headers,
        ).status_code == 404


def test_login_is_throttled_after_repeated_failures():
    with TestClient(app) as client:
        email = f"throttle-{uuid4().hex}@example.com"
        password = "Correct-horse-battery-1!"
        assert client.post(
            "/api/v1/auth/register",
            json={"email": email, "name": "Throttle", "password": password},
        ).status_code == 201
        responses = [
            client.post(
                "/api/v1/auth/login",
                data={"username": email, "password": "Wrong-password-1!"},
            )
            for _ in range(6)
        ]
        assert [response.status_code for response in responses[:5]] == [401] * 5
        assert responses[5].status_code == 429
        assert responses[5].headers["retry-after"]


def test_assignment_state_editing_history_and_recurrence():
    with TestClient(app) as client:
        headers = _register_and_login(client, "lifecycle")
        course = client.post(
            "/api/v1/courses",
            json={"name": "Operating Systems", "code": "CSE401"},
            headers=headers,
        ).json()
        assignment = client.post(
            "/api/v1/assignments",
            json={
                "title": "Read chapter one",
                "description": "Take notes",
                "due_date": "2026-09-09",
                "priority_mode": "auto",
                "recurrence_rule": "weekly",
                "recurrence_until": "2026-09-30",
                "course_id": course["id"],
            },
            headers=headers,
        ).json()
        assignment_id = assignment["id"]
        assert assignment["status"] == "pending"
        assert assignment["is_completed"] is False

        updated = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={
                "title": "Read chapter one and two",
                "description": "Take detailed notes",
                "due_date": "2026-09-10",
                "priority": "high",
                "course_id": course["id"],
                "status": "in_progress",
            },
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "in_progress"

        completed = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={"status": "completed"},
            headers=headers,
        )
        assert completed.status_code == 200
        assert completed.json()["is_completed"] is True
        submitted = client.post(
            f"/api/v1/assignments/{assignment_id}/submit",
            headers=headers,
        )
        assert submitted.status_code == 200
        assert submitted.json()["status"] == "submitted"
        assert submitted.json()["is_submitted"] is True
        history = client.get(f"/api/v1/assignments/{assignment_id}/history", headers=headers)
        assert history.status_code == 200
        assert {event["event"] for event in history.json()} >= {"created", "updated", "status_changed"}

        recurring = client.post(
            f"/api/v1/assignments/{assignment_id}/complete",
            headers=headers,
        )
        assert recurring.status_code == 200
        page = client.get("/api/v1/assignments", headers=headers).json()
        assert any(item["id"] != assignment_id and item["due_date"] == "2026-09-17" for item in page["items"])


def test_attendance_analytics_prediction_and_history():
    with TestClient(app) as client:
        headers = _register_and_login(client, "attendance-analytics")
        course = client.post(
            "/api/v1/courses",
            json={"name": "Databases", "code": "CSE501"},
            headers=headers,
        ).json()

        for record_date, record_status in (
            ("2026-09-01", "present"),
            ("2026-09-02", "present"),
            ("2026-09-03", "absent"),
            ("2026-09-04", "absent"),
        ):
            response = client.post(
                "/api/v1/attendance",
                json={"course_id": course["id"], "date": record_date, "status": record_status},
                headers=headers,
            )
            assert response.status_code == 201

        duplicate = client.post(
            "/api/v1/attendance",
            json={"course_id": course["id"], "date": "2026-09-01", "status": "absent"},
            headers=headers,
        )
        assert duplicate.status_code == 409

        threshold = client.patch(
            "/api/v1/attendance/threshold",
            json={"minimum_attendance_threshold": 75},
            headers=headers,
        )
        assert threshold.status_code == 200

        prediction = client.get(
            f"/api/v1/attendance/stats/predictions?course_id={course['id']}",
            headers=headers,
        )
        assert prediction.status_code == 200
        assert prediction.json()[0]["attend_next"] == 4
        assert prediction.json()[0]["warning_level"] == "below"

        stats = client.get("/api/v1/attendance/stats/subjects", headers=headers).json()
        assert stats["items"][0]["course_name"] == "Databases"
        trends = client.get("/api/v1/attendance/stats/trends?period=month", headers=headers)
        assert trends.status_code == 200
        assert trends.json()[0]["period"] == "2026-09"

        attendance_id = client.get("/api/v1/attendance", headers=headers).json()["items"][0]["id"]
        updated = client.patch(
            f"/api/v1/attendance/{attendance_id}",
            json={"status": "present"},
            headers=headers,
        )
        assert updated.status_code == 200
        history = client.get(f"/api/v1/attendance/{attendance_id}/history", headers=headers)
        assert {event["event"] for event in history.json()} >= {"created", "updated"}


def test_timetable_scheduling_metadata_gaps_and_exceptions():
    with TestClient(app) as client:
        headers = _register_and_login(client, "timetable-scheduling")
        course = client.post(
            "/api/v1/courses",
            json={"name": "Networks", "code": "CSE601"},
            headers=headers,
        ).json()
        first = client.post(
            "/api/v1/timetable",
            json={
                "day": "Monday",
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "room": "A101",
                "faculty": "Dr. Ada",
                "recurrence_rule": "weekly",
                "recurrence_until": "2026-12-20",
                "course_id": course["id"],
            },
            headers=headers,
        ).json()
        second = client.post(
            "/api/v1/timetable",
            json={
                "day": "Monday",
                "start_time": "11:00:00",
                "end_time": "12:00:00",
                "course_id": course["id"],
            },
            headers=headers,
        ).json()

        updated = client.patch(
            f"/api/v1/timetable/{first['id']}",
            json={"room": "A102", "faculty": "Prof. Ada"},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["faculty"] == "Prof. Ada"

        gaps = client.get("/api/v1/timetable/gaps?day=Monday", headers=headers)
        assert gaps.status_code == 200
        assert gaps.json()[0]["duration_minutes"] == 60

        exception = client.post(
            f"/api/v1/timetable/{first['id']}/exceptions",
            json={"exception_date": "2026-10-12", "status": "holiday", "note": "University holiday"},
            headers=headers,
        )
        assert exception.status_code == 201
        assert client.get(
            f"/api/v1/timetable/{first['id']}/exceptions", headers=headers
        ).json()[0]["status"] == "holiday"

        assert client.delete(f"/api/v1/timetable/{second['id']}", headers=headers).status_code == 204
