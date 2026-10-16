import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_failure_paths.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from app.core.exceptions import IdempotencyConflictError
from app.schemas.assignment import AssignmentCreate
from app.services.assignment_service import create_assignment

def test_assignment_creation_rolls_back_when_commit_fails():
    db = MagicMock()
    db.scalar.return_value = None
    db.commit.side_effect = IntegrityError("INSERT", {}, Exception("foreign key failed"))
    data = AssignmentCreate(title="Lab report", course_id=12)

    with patch("app.services.assignment_service.require_course"), patch(
        "app.services.assignment_service._record_history"
    ), patch("app.services.assignment_service._apply_status"), patch(
        "app.services.assignment_service.AssignmentRead.model_validate"
    ) as validate:
        validate.return_value.model_dump.return_value = {"id": 1}
        with pytest.raises(IntegrityError):
            create_assignment(db, 7, data, "operation-1")

    db.rollback.assert_called_once_with()


def test_assignment_retry_replays_winning_response_after_duplicate_key():
    db = MagicMock()
    db.commit.side_effect = IntegrityError(
        "INSERT",
        {},
        Exception(
            "UNIQUE constraint failed: "
            "idempotency_records.user_id, idempotency_records.operation_id"
        ),
    )
    winning_record = SimpleNamespace(
        request_hash="",
        response_body={"id": 9},
        response_status=201,
    )
    data = AssignmentCreate(title="Lab report", course_id=12)

    with patch("app.services.assignment_service.require_course"), patch(
        "app.services.assignment_service._record_history"
    ), patch("app.services.assignment_service._apply_status"), patch(
        "app.services.assignment_service.AssignmentRead.model_validate"
    ) as validate, patch(
        "app.services.assignment_service._assignment_request_hash", return_value=""
    ):
        validate.return_value.model_dump.return_value = {"id": 9}
        db.scalar.side_effect = [None, winning_record]
        assert create_assignment(db, 7, data, "operation-1") == ({"id": 9}, 201)

    db.rollback.assert_called_once_with()


def test_assignment_same_key_with_different_payload_is_a_conflict():
    db = MagicMock()
    existing = SimpleNamespace(
        request_hash="stored-hash",
        response_body={"id": 9},
        response_status=201,
    )
    db.scalar.return_value = existing

    with patch("app.services.assignment_service._assignment_request_hash", return_value="new-hash"):
        with pytest.raises(IdempotencyConflictError):
            create_assignment(db, 7, AssignmentCreate(title="Changed", course_id=12), "operation-1")


def test_worker_requeues_task_when_shutdown_interrupts_retry_backoff():
    from app.jobs import deadline_email_worker as worker

    task = worker.DeadlineEmailTask()
    with patch.object(worker, "run_deadline_email_job", side_effect=TimeoutError("temporary")), patch.object(
        worker, "_INITIAL_RETRY_DELAY_SECONDS", 0
    ), patch.object(worker, "_stop_requested") as stop_requested, patch.object(
        worker._tasks, "put"
    ) as put:
        stop_requested.wait.return_value = True
        worker._run_with_retries(task)

    put.assert_called_once_with(task)
