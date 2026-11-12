from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_ok():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_document_is_available():
    with TestClient(app) as client:
        response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    document = response.json()
    assert document["info"]["title"] == "Scholaris API"
    assert "/api/v1/health" in document["paths"]
