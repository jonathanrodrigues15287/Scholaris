import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.sql import nullslast
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, IdempotencyConflictError, VersionConflictError
from app.models.assignment import Assignment, AssignmentHistory
from app.models.course import Course
from app.models.idempotency import IdempotencyRecord
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.utils.helpers import apply_partial_update
from app.utils.pagination import fetch_page
from app.utils.validators import require_assignment, require_course

_STATUS_ORDER = {"pending": 0, "in_progress": 1, "completed": 2, "submitted": 3}


def _priority_for(data: AssignmentCreate | AssignmentUpdate, current: Assignment | None = None) -> str:
	due_date = data.due_date if data.due_date is not None else (current.due_date if current else None)
	if getattr(data, "priority_mode", None) == "auto" or (current and current.priority_mode == "auto"):
		if due_date is None:
			return "medium"
		days_left = (due_date - date.today()).days
		return "high" if days_left <= 2 else "medium" if days_left <= 7 else "low"
	return data.priority if data.priority is not None else (current.priority if current else "medium")


def _apply_status(assignment: Assignment, status: str) -> None:
	if status not in _STATUS_ORDER:
		raise ConflictError("Invalid assignment status transition")
	previous = assignment.status
	if previous == "submitted" and status != "submitted":
		raise ConflictError("Submitted assignments cannot change state")
	if status == "submitted" and previous != "completed":
		raise ConflictError("Only completed assignments can be submitted")
	if _STATUS_ORDER[status] > _STATUS_ORDER[previous] + 1 and not (
		previous == "pending" and status == "completed"
	):
		raise ConflictError("Assignment status transition is not allowed")
	assignment.status = status
	assignment.is_completed = status in {"completed", "submitted"}
	assignment.is_submitted = status == "submitted"
	now = datetime.now(timezone.utc)
	if status == "completed" and assignment.completed_at is None:
		assignment.completed_at = now
	if status == "submitted" and assignment.submitted_at is None:
		assignment.submitted_at = now


def _record_history(db: Session, assignment: Assignment, user_id: int, event: str, previous: str | None = None) -> None:
	db.add(
		AssignmentHistory(
			assignment_id=assignment.id,
			user_id=user_id,
			event=event,
			from_status=previous,
			to_status=assignment.status,
		)
	)


def _next_recurrence_date(current: date, rule: str) -> date:
	if rule == "daily":
		return current + timedelta(days=1)
	if rule == "weekly":
		return current + timedelta(weeks=1)
	return current + timedelta(days=30)


def _create_next_recurrence(db: Session, assignment: Assignment, owner_id: int) -> Assignment | None:
	if not assignment.recurrence_rule or not assignment.due_date:
		return None
	next_due = _next_recurrence_date(assignment.due_date, assignment.recurrence_rule)
	if assignment.recurrence_until and next_due > assignment.recurrence_until:
		return None
	next_assignment = Assignment(
		user_id=owner_id,
		course_id=assignment.course_id,
		title=assignment.title,
		description=assignment.description,
		due_date=next_due,
		priority=assignment.priority,
		priority_mode=assignment.priority_mode,
		recurrence_rule=assignment.recurrence_rule,
		recurrence_until=assignment.recurrence_until,
		reminder_at=(assignment.reminder_at + (next_due - assignment.due_date)) if assignment.reminder_at else None,
		attachment_name=assignment.attachment_name,
		attachment_url=assignment.attachment_url,
	)
	db.add(next_assignment)
	db.flush()
	_record_history(db, next_assignment, owner_id, "created")
	return next_assignment


def list_assignments(
	db: Session,
	owner_id: int,
	priority: str | None = None,
	status: str | None = None,
	overdue: bool = False,
	page: int = 1,
	page_size: int = 20,
	course_id: int | None = None,
	sort_by: str = "due_date",
	sort_order: str = "asc",
) -> tuple[list[Assignment], int]:
	query = (
		select(Assignment)
		.join(Course)
		.where(
			Course.user_id == owner_id,
			Course.deleted_at.is_(None),
			Assignment.deleted_at.is_(None),
		)
	)
	if priority is not None:
		query = query.where(Assignment.priority == priority)
	if status is not None:
		query = query.where(Assignment.status == status)
	if overdue:
		query = query.where(
			Assignment.due_date < date.today(),
			Assignment.status.not_in(("completed", "submitted")),
		)
	if course_id is not None:
		query = query.where(Assignment.course_id == course_id)
	sort_column = {
		"title": Assignment.title,
		"due_date": Assignment.due_date,
		"priority": Assignment.priority,
		"status": Assignment.status,
		"created_at": Assignment.created_at,
	}.get(sort_by, Assignment.due_date)
	ordered = sort_column.asc() if sort_order == "asc" else sort_column.desc()
	return fetch_page(query.order_by(nullslast(ordered)), db, page, page_size)


def _assignment_request_hash(data: AssignmentCreate) -> str:
	payload = json.dumps(data.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
	return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _replay_idempotent_response(
	record: IdempotencyRecord,
	request_hash: str,
) -> tuple[dict[str, Any], int]:
	if record.request_hash != request_hash:
		raise IdempotencyConflictError("Idempotency key was already used with a different request")
	return record.response_body, record.response_status


def _is_idempotency_unique_violation(error: IntegrityError) -> bool:
	original = error.orig
	constraint_name = getattr(getattr(original, "diag", None), "constraint_name", None)
	if constraint_name == "uq_idempotency_user_operation":
		return True
	message = str(original).lower()
	return (
		"unique constraint failed: idempotency_records.user_id, idempotency_records.operation_id"
		in message
	)


def create_assignment(
	db: Session,
	owner_id: int,
	data: AssignmentCreate,
	operation_id: str,
) -> tuple[dict[str, Any], int]:
	request_hash = _assignment_request_hash(data)
	existing = db.scalar(
		select(IdempotencyRecord).where(
			IdempotencyRecord.user_id == owner_id,
			IdempotencyRecord.operation_id == operation_id,
		)
	)
	if existing is not None:
		return _replay_idempotent_response(existing, request_hash)

	require_course(db, owner_id, data.course_id)
	values = data.model_dump()
	values["priority"] = _priority_for(data)
	assignment = Assignment(**values, user_id=owner_id)
	_apply_status(assignment, data.status)
	db.add(assignment)
	db.flush()
	db.refresh(assignment)
	_record_history(db, assignment, owner_id, "created")
	response_body = AssignmentRead.model_validate(assignment).model_dump(mode="json")
	db.add(
		IdempotencyRecord(
			user_id=owner_id,
			operation_id=operation_id,
			request_hash=request_hash,
			response_status=201,
			response_body=response_body,
		)
	)
	try:
		db.commit()
	except IntegrityError as exc:
		db.rollback()
		if not _is_idempotency_unique_violation(exc):
			raise
		concurrent_record = db.scalar(
			select(IdempotencyRecord).where(
				IdempotencyRecord.user_id == owner_id,
				IdempotencyRecord.operation_id == operation_id,
			)
		)
		if concurrent_record is None:
			raise
		return _replay_idempotent_response(concurrent_record, request_hash)
	return response_body, 201


def get_assignment(db: Session, owner_id: int, assignment_id: int) -> Assignment:
	return require_assignment(db, owner_id, assignment_id)


def _commit_assignment_transaction(db: Session) -> None:
	try:
		db.commit()
	except StaleDataError as exc:
		db.rollback()
		raise VersionConflictError(
			"Assignment changed on another device; fetch the latest version and retry"
		) from exc
	except SQLAlchemyError:
		db.rollback()
		raise


def update_assignment(db: Session, owner_id: int, assignment_id: int, data: AssignmentUpdate) -> Assignment:
	assignment = require_assignment(db, owner_id, assignment_id)
	values = data.model_dump(exclude_unset=True)
	if data.version != assignment.version:
		raise VersionConflictError("Assignment changed on another device; fetch the latest version and retry")
	values.pop("version")
	previous_status = assignment.status
	if "course_id" in values:
		require_course(db, owner_id, values["course_id"])
	requested_status = values.pop("status", None)
	if requested_status is not None:
		_apply_status(assignment, requested_status)
	apply_partial_update(assignment, values)
	if "priority_mode" in values or "due_date" in values:
		assignment.priority = _priority_for(data, assignment)
	assignment.updated_at = datetime.now(timezone.utc)
	event = (
		"submitted"
		if requested_status == "submitted"
		else "completed"
		if requested_status == "completed"
		else "status_changed"
		if requested_status and requested_status != previous_status
		else "updated"
	)
	try:
		if requested_status == "completed" and previous_status != "completed":
			_create_next_recurrence(db, assignment, owner_id)
		_record_history(db, assignment, owner_id, event, previous_status if requested_status and requested_status != previous_status else None)
		_commit_assignment_transaction(db)
	except StaleDataError as exc:
		# A flush triggered before commit can also report an optimistic-lock conflict.
		db.rollback()
		raise VersionConflictError(
			"Assignment changed on another device; fetch the latest version and retry"
		) from exc
	except SQLAlchemyError:
		db.rollback()
		raise
	return assignment


def mark_assignment_completed(db: Session, owner_id: int, assignment_id: int) -> Assignment:
	assignment = require_assignment(db, owner_id, assignment_id)
	previous = assignment.status
	_apply_status(assignment, "completed")
	try:
		_record_history(db, assignment, owner_id, "completed", previous)
		if previous != "completed":
			_create_next_recurrence(db, assignment, owner_id)
		_commit_assignment_transaction(db)
	except StaleDataError as exc:
		db.rollback()
		raise VersionConflictError(
			"Assignment changed on another device; fetch the latest version and retry"
		) from exc
	except SQLAlchemyError:
		db.rollback()
		raise
	return assignment


def submit_assignment(db: Session, owner_id: int, assignment_id: int) -> Assignment:
	assignment = require_assignment(db, owner_id, assignment_id)
	previous = assignment.status
	_apply_status(assignment, "submitted")
	_record_history(db, assignment, owner_id, "submitted", previous)
	_commit_assignment_transaction(db)
	return assignment


def delete_assignment(db: Session, owner_id: int, assignment_id: int) -> None:
	assignment = require_assignment(db, owner_id, assignment_id)
	assignment.deleted_at = datetime.now(timezone.utc)
	_record_history(db, assignment, owner_id, "deleted")
	db.commit()


def list_assignment_history(db: Session, owner_id: int, assignment_id: int) -> list[AssignmentHistory]:
	require_assignment(db, owner_id, assignment_id)
	return list(
		db.scalars(
			select(AssignmentHistory)
			.where(AssignmentHistory.assignment_id == assignment_id, AssignmentHistory.user_id == owner_id)
			.order_by(AssignmentHistory.created_at.desc())
		)
	)


def list_due_reminders(db: Session, owner_id: int) -> list[Assignment]:
	return list(
		db.scalars(
			select(Assignment)
			.join(Course)
			.where(
				Assignment.user_id == owner_id,
				Assignment.deleted_at.is_(None),
				Course.deleted_at.is_(None),
				Assignment.reminder_at <= datetime.now(timezone.utc),
				Assignment.reminder_sent_at.is_(None),
				Assignment.status.not_in(("completed", "submitted")),
			)
			.order_by(Assignment.reminder_at)
		)
	)


def mark_reminder_sent(db: Session, owner_id: int, assignment_id: int) -> Assignment:
	assignment = require_assignment(db, owner_id, assignment_id)
	if assignment.reminder_at is None:
		raise ConflictError("Assignment has no reminder configured")
	assignment.reminder_sent_at = datetime.now(timezone.utc)
	_record_history(db, assignment, owner_id, "reminder_sent")
	_commit_assignment_transaction(db)
	return assignment


def list_deadline_notifications(db: Session, owner_id: int, days: int = 1) -> list[Assignment]:
	"Return incomplete assignments due now through the requested horizon."
	deadline = date.today() + timedelta(days=days)
	return list(
		db.scalars(
			select(Assignment)
			.join(Course)
			.where(
				Assignment.user_id == owner_id,
				Assignment.deleted_at.is_(None),
				Course.deleted_at.is_(None),
				Assignment.due_date.is_not(None),
				Assignment.due_date <= deadline,
				Assignment.status.not_in(("completed", "submitted")),
			)
			.order_by(Assignment.due_date, Assignment.priority)
		)
	)
