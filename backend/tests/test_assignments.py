def _create_course(api_client, headers):
    response = api_client.post(
        "/api/v1/courses",
        json={"name": "Algorithms", "code": "CSE201"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_assignment_lifecycle_and_history(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    create_headers = {**auth_headers, "X-Idempotency-Key": f"assignment-create-{uuid4().hex}"}
    created = api_client.post(
        "/api/v1/assignments",
        json={"title": "Implement a graph", "course_id": course["id"], "priority": "high"},
        headers=create_headers,
    )
    assert created.status_code == 201
    assignment_id = created.json()["id"]
    initial_version = created.json()["version"]
    assert initial_version == 1

    missing_version = api_client.patch(
        f"/api/v1/assignments/{assignment_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert missing_version.status_code == 422

    updated = api_client.patch(
        f"/api/v1/assignments/{assignment_id}",
        json={"status": "in_progress", "version": initial_version},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"
    assert updated.json()["version"] == initial_version + 1

    stale_update = api_client.patch(
        f"/api/v1/assignments/{assignment_id}",
        json={"title": "Stale update", "version": initial_version},
        headers=auth_headers,
    )
    assert stale_update.status_code == 409
    assert stale_update.json()["code"] == "VERSION_CONFLICT"

    completed = api_client.post(
        f"/api/v1/assignments/{assignment_id}/complete",
        headers=auth_headers,
    )
    assert completed.status_code == 200
    assert completed.json()["is_completed"] is True

    history = api_client.get(
        f"/api/v1/assignments/{assignment_id}/history",
        headers=auth_headers,
    )
    assert history.status_code == 200
    assert {event["event"] for event in history.json()} >= {"created", "updated", "status_changed"}


def test_assignment_create_idempotency_replays_and_rejects_payload_changes(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    missing_key = api_client.post(
        "/api/v1/assignments",
        json={"title": "Missing operation key", "course_id": course["id"]},
        headers=auth_headers,
    )
    assert missing_key.status_code == 422

    headers = {
        **auth_headers,
        "X-Idempotency-Key": f"assignment-create-{uuid4().hex}",
    }
    payload = {"title": "Queued assignment", "course_id": course["id"]}

    created = api_client.post("/api/v1/assignments", json=payload, headers=headers)
    replayed = api_client.post("/api/v1/assignments", json=payload, headers=headers)
    assert created.status_code == replayed.status_code == 201
    assert replayed.json() == created.json()

    conflicting = api_client.post(
        "/api/v1/assignments",
        json={"title": "Different assignment", "course_id": course["id"]},
        headers=headers,
    )
    assert conflicting.status_code == 409
    assert conflicting.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_assignment_delete_removes_it_from_active_list(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    assignment = api_client.post(
        "/api/v1/assignments",
        json={"title": "Delete me", "course_id": course["id"]},
        headers={**auth_headers, "X-Idempotency-Key": f"assignment-delete-test-{uuid4().hex}"},
    ).json()

    deleted = api_client.delete(f"/api/v1/assignments/{assignment['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    page = api_client.get("/api/v1/assignments", headers=auth_headers).json()
    assert all(item["id"] != assignment["id"] for item in page["items"])
