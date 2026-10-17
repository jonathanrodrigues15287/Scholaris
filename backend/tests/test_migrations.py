import os

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text


pytestmark = pytest.mark.db


@pytest.fixture
def migration_config():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to run migration integration tests")
    os.environ["DATABASE_URL"] = database_url
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    config = Config("backend/alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def test_clean_database_upgrade_has_one_head_and_required_schema(migration_config):
    if os.environ.get("TEST_DATABASE_IS_DISPOSABLE") != "1":
        pytest.skip("Migration smoke tests require a disposable database")

    database_url = os.environ["TEST_DATABASE_URL"]
    engine = create_engine(database_url)
    if engine.dialect.name != "postgresql":
        engine.dispose()
        pytest.skip("Migration smoke tests require PostgreSQL")
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    script = ScriptDirectory.from_config(migration_config)
    assert script.get_heads() == ["0017_assignment_versions"]

    command.upgrade(migration_config, "head")
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    assert {
        "users",
        "courses",
        "assignments",
        "assignment_history",
        "idempotency_records",
        "refresh_tokens",
    }.issubset(tables)

    assignment_columns = {column["name"] for column in inspector.get_columns("assignments")}
    assert {"version", "deadline_email_sent_for"}.issubset(assignment_columns)

    idempotency_constraints = {
        constraint["name"] for constraint in inspector.get_unique_constraints("idempotency_records")
    }
    assert "uq_idempotency_user_operation" in idempotency_constraints

    refresh_indexes = {index["name"] for index in inspector.get_indexes("refresh_tokens")}
    assert "ix_refresh_tokens_token_hash" in refresh_indexes

    command.downgrade(migration_config, "base")
    assert "users" not in set(inspect(engine).get_table_names())
    command.upgrade(migration_config, "head")
    assert "users" in set(inspect(engine).get_table_names())
    engine.dispose()
