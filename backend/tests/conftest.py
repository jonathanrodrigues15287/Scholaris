import os
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def api_app():
    test_database_url = os.environ.get("TEST_DATABASE_URL")
    if not test_database_url:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL API integration tests")

    os.environ["DATABASE_URL"] = test_database_url
    os.environ["JWT_SECRET_KEY"] = "test-secret-key-with-at-least-32-characters"

    from app.main import app

    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    return app


@pytest.fixture
def api_client(api_app):
    with TestClient(api_app) as client:
        yield client


@pytest.fixture
def auth_headers(api_client):
    email = f"api-test-{uuid4().hex}@example.com"
    password = "Correct-horse-battery-1!"
    response = api_client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "API Test User", "password": password},
    )
    assert response.status_code == 201
    response = api_client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return {"X-CSRF-Token": api_client.cookies.get("csrf_token")}
