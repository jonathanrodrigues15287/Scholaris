from datetime import date

from app.core.security import create_access_token, hash_password
from app.models.course import Course
from app.models.user import User


def _create_user(db_session, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        name=username.title(),
        hashed_password=hash_password("StrongPassword1!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _bearer(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _create_course(db_session, user: User) -> Course:
    course = Course(user_id=user.id, name="Algorithms", code="CS101", credits=3)
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


def _assignment_payload(course_id: int, title: str = "Graph worksheet") -> dict:
    return {
        "title": title,
        "description": "Review graph traversal",
        "due_date": date(2030, 1, 15).isoformat(),
        "priority": "medium",
        "status": "pending",
        "priority_mode": "manual",
        "course_id": course_id,
    }


def test_same_idempotency_key_and_payload_replays_original_response(client, db_session):
    user = _create_user(db_session, "idempotent")
    course = _create_course(db_session, user)
    headers = {**_bearer(user), "X-Idempotency-Key": "operation-1"}
    payload = _assignment_payload(course.id)

    first = client.post("/api/v1/assignments", json=payload, headers=headers)
    second = client.post("/api/v1/assignments", json=payload, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json() == first.json()


def test_same_idempotency_key_with_different_payload_returns_conflict(client, db_session):
    user = _create_user(db_session, "idempotent-conflict")
    course = _create_course(db_session, user)
    headers = {**_bearer(user), "X-Idempotency-Key": "operation-2"}

    first = client.post(
        "/api/v1/assignments",
        json=_assignment_payload(course.id),
        headers=headers,
    )
    second = client.post(
        "/api/v1/assignments",
        json=_assignment_payload(course.id, "Different worksheet"),
        headers=headers,
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_user_cannot_read_another_users_assignment(client, db_session):
    owner = _create_user(db_session, "assignment-owner")
    other_user = _create_user(db_session, "assignment-reader")
    course = _create_course(db_session, owner)
    created = client.post(
        "/api/v1/assignments",
        json=_assignment_payload(course.id),
        headers={**_bearer(owner), "X-Idempotency-Key": "owner-operation"},
    )
    assignment_id = created.json()["id"]

    response = client.get(
        f"/api/v1/assignments/{assignment_id}",
        headers=_bearer(other_user),
    )

    assert created.status_code == 201
    assert response.status_code == 404
    assert response.json()["code"] == "NOTFOUND"


def test_authenticated_mutation_without_csrf_returns_forbidden(client):
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "username": "csrf-user",
            "email": "csrf@example.com",
            "name": "CSRF User",
            "password": "StrongPassword1!",
        },
    )
    assert registered.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        data={"username": "csrf-user", "password": "StrongPassword1!"},
    )

    assert login.status_code == 200
    response = client.post(
        "/api/v1/courses",
        json={"name": "Databases", "code": "DB101"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_ERROR"
