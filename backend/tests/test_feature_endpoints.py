from datetime import date, datetime, time, timezone

from app.core.security import create_access_token, hash_password
from app.models.course import Course
from app.models.user import User


def _user(db_session, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        name=username,
        hashed_password=hash_password("StrongPassword1!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _course(db_session, user: User) -> Course:
    course = Course(user_id=user.id, name="Algorithms", code="CS101", credits=3)
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


def test_attendance_create_summary_and_prediction(client, db_session):
    user = _user(db_session, "attendance-user")
    course = _course(db_session, user)
    headers = _headers(user)

    for offset, status in enumerate(("present", "present", "absent", "present")):
        response = client.post(
            "/api/v1/attendance",
            json={
                "course_id": course.id,
                "date": date(2030, 1, 1 + offset).isoformat(),
                "status": status,
            },
            headers=headers,
        )
        assert response.status_code == 201

    summary = client.get("/api/v1/attendance/summary", headers=headers)
    predictions = client.get("/api/v1/attendance/stats/predictions", headers=headers)

    assert summary.status_code == 200
    assert summary.json()["items"][0]["percentage"] == 75.0
    assert predictions.status_code == 200
    assert predictions.json()[0]["warning_level"] == "approaching"


def test_timetable_create_conflict_and_gap_endpoint(client, db_session):
    user = _user(db_session, "timetable-user")
    course = _course(db_session, user)
    headers = _headers(user)
    first = {
        "day": "Monday",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "room": "A1",
        "course_id": course.id,
    }

    created = client.post("/api/v1/timetable", json=first, headers=headers)
    conflict = client.post(
        "/api/v1/timetable",
        json={**first, "start_time": "09:30:00", "end_time": "10:30:00"},
        headers=headers,
    )
    gaps = client.get("/api/v1/timetable/gaps", headers=headers)

    assert created.status_code == 201
    assert conflict.status_code == 409
    assert gaps.status_code == 200
    assert gaps.json() == []


def test_study_session_and_goal_endpoints(client, db_session):
    user = _user(db_session, "study-user")
    course = _course(db_session, user)
    headers = _headers(user)
    session = client.post(
        "/api/v1/study/sessions",
        json={
            "start_time": datetime.now(timezone.utc).replace(
                hour=10, minute=0, second=0, microsecond=0
            ).isoformat(),
            "duration": 1500,
            "course_id": course.id,
        },
        headers=headers,
    )
    goal = client.patch(
        "/api/v1/study/goal",
        json={"weekly_study_goal_minutes": 420},
        headers=headers,
    )
    stats = client.get("/api/v1/study/stats", headers=headers)

    assert session.status_code == 201
    assert goal.status_code == 200
    assert goal.json()["weekly_study_goal_minutes"] == 420
    assert stats.status_code == 200
    assert stats.json()["weekly"] == 25


def test_assignment_lifecycle_and_optimistic_version_conflict(client, db_session):
    user = _user(db_session, "lifecycle-user")
    course = _course(db_session, user)
    headers = {**_headers(user), "X-Idempotency-Key": "lifecycle-operation"}
    created = client.post(
        "/api/v1/assignments",
        json={"title": "Lifecycle", "course_id": course.id},
        headers=headers,
    )
    assignment = created.json()
    assignment_path = f"/api/v1/assignments/{assignment['id']}"

    updated = client.patch(
        assignment_path,
        json={"title": "Updated", "version": assignment["version"]},
        headers=_headers(user),
    )
    stale = client.patch(
        assignment_path,
        json={"title": "Stale edit", "version": assignment["version"]},
        headers=_headers(user),
    )
    completed = client.post(f"{assignment_path}/complete", headers=_headers(user))
    submitted = client.post(f"{assignment_path}/submit", headers=_headers(user))

    assert updated.status_code == 200
    assert stale.status_code == 409
    assert stale.json()["code"] == "VERSION_CONFLICT"
    assert completed.status_code == 200
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"


def test_academic_records_round_trip_and_weighted_cgpa(client, db_session):
    user = _user(db_session, "academic-user")
    headers = _headers(user)
    semester = client.post(
        "/api/v1/cgpa/semesters",
        json={"name": "First semester", "semester_number": 1, "academic_year": "2030-31"},
        headers=headers,
    )
    assert semester.status_code == 201

    first_course = client.post(
        f"/api/v1/cgpa/semesters/{semester.json()['id']}/courses",
        json={"name": "Algorithms", "code": "CS101", "credits": 3, "grade": 8},
        headers=headers,
    )
    second_course = client.post(
        f"/api/v1/cgpa/semesters/{semester.json()['id']}/courses",
        json={"name": "Networks", "code": "CS102", "credits": 1, "grade": 10},
        headers=headers,
    )
    records = client.get("/api/v1/cgpa/records", headers=headers)

    assert first_course.status_code == 201
    assert second_course.status_code == 201
    assert records.status_code == 200
    assert records.json()["cgpa"] == 8.5
    assert records.json()["total_credits"] == 4
