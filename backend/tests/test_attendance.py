def _create_course(api_client, headers):
    response = api_client.post(
        "/api/v1/courses",
        json={"name": "Databases", "code": "CSE301"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_attendance_duplicate_protection_and_analytics(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    for record_date, status in (("2026-09-01", "present"), ("2026-09-02", "absent")):
        response = api_client.post(
            "/api/v1/attendance",
            json={"course_id": course["id"], "date": record_date, "status": status},
            headers=auth_headers,
        )
        assert response.status_code == 201

    duplicate = api_client.post(
        "/api/v1/attendance",
        json={"course_id": course["id"], "date": "2026-09-01", "status": "absent"},
        headers=auth_headers,
    )
    assert duplicate.status_code == 409

    stats = api_client.get(
        f"/api/v1/attendance/stats/subjects?course_id={course['id']}",
        headers=auth_headers,
    )
    assert stats.status_code == 200
    assert stats.json()["items"][0]["course_name"] == "Databases"


def test_attendance_delete_is_authorized(api_client, auth_headers):
    course = _create_course(api_client, auth_headers)
    record = api_client.post(
        "/api/v1/attendance",
        json={"course_id": course["id"], "date": "2026-09-03", "status": "present"},
        headers=auth_headers,
    ).json()

    deleted = api_client.delete(f"/api/v1/attendance/{record['id']}", headers=auth_headers)
    assert deleted.status_code == 204
