import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_assignment_concurrency.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from app.core.exceptions import VersionConflictError
from app.schemas.assignment import AssignmentUpdate
from app.services.assignment_service import (
    _is_idempotency_unique_violation,
    mark_assignment_completed,
    update_assignment,
)


def _assignment(**overrides):
    values = {
        "id": 1,
        "version": 4,
        "title": "Read chapter",
        "status": "pending",
        "priority": "medium",
        "priority_mode": "manual",
        "due_date": None,
        "course_id": 1,
        "recurrence_rule": None,
        "recurrence_until": None,
        "reminder_at": None,
        "description": None,
        "attachment_name": None,
        "attachment_url": None,
        "updated_at": None,
        "completed_at": None,
        "is_completed": False,
        "is_submitted": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_update_translates_orm_stale_write_to_version_conflict_and_rolls_back():
    db = MagicMock()
    db.commit.side_effect = StaleDataError("UPDATE", {}, Exception("stale"))
    assignment = _assignment()

    with patch("app.services.assignment_service.require_assignment", return_value=assignment):
        with pytest.raises(VersionConflictError):
            update_assignment(db, 7, assignment.id, AssignmentUpdate(title="New title", version=4))

    db.rollback.assert_called_once_with()


def test_completion_commits_assignment_history_and_recurrence_together():
    db = MagicMock()
    assignment = _assignment(recurrence_rule="weekly")

    with patch("app.services.assignment_service.require_assignment", return_value=assignment), patch(
        "app.services.assignment_service._create_next_recurrence"
    ) as create_recurrence:
        mark_assignment_completed(db, 7, assignment.id)

    create_recurrence.assert_called_once()
    db.commit.assert_called_once_with()


def test_completion_rolls_back_when_recurrence_creation_fails():
    db = MagicMock()
    assignment = _assignment(recurrence_rule="weekly")
    recurrence_error = IntegrityError("INSERT", {}, Exception("constraint"))

    with patch("app.services.assignment_service.require_assignment", return_value=assignment), patch(
        "app.services.assignment_service._create_next_recurrence", side_effect=recurrence_error
    ):
        with pytest.raises(IntegrityError):
            mark_assignment_completed(db, 7, assignment.id)

    db.rollback.assert_called_once_with()
    db.commit.assert_not_called()


def test_unrelated_integrity_errors_are_not_treated_as_idempotency_retries():
    error = IntegrityError(
        "INSERT",
        {},
        Exception("FOREIGN KEY constraint failed"),
    )

    assert _is_idempotency_unique_violation(error) is False


def test_idempotency_unique_constraint_is_detected_for_sqlite():
    error = IntegrityError(
        "INSERT",
        {},
        Exception(
            "UNIQUE constraint failed: "
            "idempotency_records.user_id, idempotency_records.operation_id"
        ),
    )

    assert _is_idempotency_unique_violation(error) is True


def test_idempotency_unique_constraint_is_detected_for_postgresql():
    original = SimpleNamespace(
        diag=SimpleNamespace(constraint_name="uq_idempotency_user_operation")
    )
    error = IntegrityError("INSERT", {}, original)

    assert _is_idempotency_unique_violation(error) is True
