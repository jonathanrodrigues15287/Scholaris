from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.routers.dependencies import PaginationParams
from app.schemas.assignment import AssignmentCreate, AssignmentHistoryRead, AssignmentRead, AssignmentUpdate
from app.schemas.common import Page, make_page
from app.services.assignment_service import (
	create_assignment,
	delete_assignment,
	get_assignment,
	list_deadline_notifications,
	list_due_reminders,
	list_assignment_history,
	list_assignments,
	mark_reminder_sent,
	mark_assignment_completed,
	submit_assignment,
	update_assignment,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=Page[AssignmentRead])
def get_assignments(
	priority: str | None = Query(default=None, pattern="^(high|medium|low)$"),
	status: str | None = Query(default=None, pattern="^(pending|in_progress|completed|submitted)$"),
	overdue: bool = False,
	course_id: int | None = Query(default=None, ge=1),
	sort_by: Literal["title", "due_date", "priority", "status", "created_at"] = "due_date",
	sort_order: Literal["asc", "desc"] = "asc",
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = list_assignments(
		db,
		user.id,
		priority=priority,
		status=status,
		overdue=overdue,
		course_id=course_id,
		sort_by=sort_by,
		sort_order=sort_order,
		page=pagination.page,
		page_size=pagination.page_size,
	)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.post("", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def add_assignment(
	data: AssignmentCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return create_assignment(db, user.id, data)


@router.get("/reminders/due", response_model=list[AssignmentRead])
def get_due_assignment_reminders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return list_due_reminders(db, user.id)


@router.post("/{assignment_id}/reminder-sent", response_model=AssignmentRead)
def acknowledge_assignment_reminder(
	assignment_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return mark_reminder_sent(db, user.id, assignment_id)


@router.get("/notifications/deadlines", response_model=list[AssignmentRead])
def get_deadline_notifications(
	days: int = Query(default=1, ge=0, le=30),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return list_deadline_notifications(db, user.id, days)


@router.post("/{assignment_id}/complete", response_model=AssignmentRead)
def complete_assignment(
	assignment_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return mark_assignment_completed(db, user.id, assignment_id)


@router.post("/{assignment_id}/submit", response_model=AssignmentRead)
def submit_assignment_item(
	assignment_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return submit_assignment(db, user.id, assignment_id)


@router.get("/{assignment_id}/history", response_model=list[AssignmentHistoryRead])
def get_assignment_history(assignment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return list_assignment_history(db, user.id, assignment_id)


@router.get("/{assignment_id}", response_model=AssignmentRead)
def get_assignment_item(assignment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_assignment(db, user.id, assignment_id)


@router.patch("/{assignment_id}", response_model=AssignmentRead)
def edit_assignment(
	assignment_id: int,
	data: AssignmentUpdate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return update_assignment(db, user.id, assignment_id, data)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_assignment(
	assignment_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	delete_assignment(db, user.id, assignment_id)

