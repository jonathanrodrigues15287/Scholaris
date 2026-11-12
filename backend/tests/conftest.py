import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "ci-only-secret-key-with-at-least-32-characters")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "false")


@pytest.fixture(autouse=True)
def clear_login_rate_limit_state():
    from app.core import rate_limit

    rate_limit._failures.clear()
    yield
    rate_limit._failures.clear()


@pytest.fixture
def db_session():
    from app.core.database import Base
    import app.models

    database_url = os.getenv("TEST_DATABASE_URL", "sqlite://")
    engine_options = {}
    if database_url.startswith("sqlite"):
        engine_options = {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    engine = create_engine(database_url, **engine_options)
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = test_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    from app.main import app
    from app.core.database import get_db

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)
