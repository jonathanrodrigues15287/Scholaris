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
    created = api_client.post(
        "/api/v1/assignments",
        json={"title": "Implement a graph", "course_id": course["id"], "priority": "high"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    assignment_id = created.json()["id"]

    updated = api_client.patch(
        f"/api/v1/assignments/{assignment_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"

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


def test_assignment_delete_removes_it_from_active_list(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    assignment = api_client.post(
        "/api/v1/assignments",
        json={"title": "Delete me", "course_id": course["id"]},
        headers=auth_headers,
    ).json()

    deleted = api_client.delete(f"/api/v1/assignments/{assignment['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    page = api_client.get("/api/v1/assignments", headers=auth_headers).json()
    assert all(item["id"] != assignment["id"] for item in page["items"])


def test_assignment_create_replays_idempotent_result(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    headers = {**auth_headers, "X-Idempotency-Key": "assignment-create-operation-1"}
    payload = {"title": "Retry-safe lab", "course_id": course["id"]}

    first = api_client.post("/api/v1/assignments", json=payload, headers=headers)
    replay = api_client.post("/api/v1/assignments", json=payload, headers=headers)

    assert first.status_code == replay.status_code == 201
    assert first.json() == replay.json()
    assignments = api_client.get("/api/v1/assignments", headers=auth_headers).json()["items"]
    assert sum(item["title"] == "Retry-safe lab" for item in assignments) == 1

    changed_payload = {**payload, "title": "Changed after retry"}
    mismatch = api_client.post("/api/v1/assignments", json=changed_payload, headers=headers)
    assert mismatch.status_code == 409
