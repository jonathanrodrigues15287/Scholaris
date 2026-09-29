def test_cgpa_records_create_update_and_delete(api_client, auth_headers):
    semester = api_client.post(
        "/api/v1/cgpa/semesters",
        json={"name": "Semester 1", "semester_number": 1, "academic_year": "2026-27"},
        headers=auth_headers,
    )
    assert semester.status_code == 201
    semester_id = semester.json()["id"]

    course = api_client.post(
        f"/api/v1/cgpa/semesters/{semester_id}/courses",
        json={"name": "Algorithms", "code": "CSE201", "credits": 3, "grade": 8},
        headers=auth_headers,
    )
    assert course.status_code == 201
    course_id = course.json()["id"]

    updated = api_client.patch(
        f"/api/v1/cgpa/courses/{course_id}",
        json={"grade": 9},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["grade"] == 9

    records = api_client.get("/api/v1/cgpa/records", headers=auth_headers)
    assert records.status_code == 200
    assert records.json()["cgpa"] == 9

    assert api_client.delete(f"/api/v1/cgpa/courses/{course_id}", headers=auth_headers).status_code == 204
    assert api_client.get("/api/v1/cgpa/records", headers=auth_headers).json()["semesters"][0]["courses"] == []


def test_deleting_semester_removes_its_academic_records(api_client, auth_headers):
    semester = api_client.post(
        "/api/v1/cgpa/semesters",
        json={"name": "Semester 2", "semester_number": 2, "academic_year": "2026-27"},
        headers=auth_headers,
    ).json()
    course = api_client.post(
        f"/api/v1/cgpa/semesters/{semester['id']}/courses",
        json={"name": "Databases", "code": "CSE202", "credits": 3, "grade": 7},
        headers=auth_headers,
    ).json()

    deleted = api_client.delete(f"/api/v1/cgpa/semesters/{semester['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert api_client.get("/api/v1/cgpa/records", headers=auth_headers).json()["semesters"] == []
    assert api_client.delete(f"/api/v1/cgpa/courses/{course['id']}", headers=auth_headers).status_code == 404
