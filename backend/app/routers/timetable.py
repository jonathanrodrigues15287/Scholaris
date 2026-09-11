from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import PaginationParams, get_current_user
from app.schemas.common import Page, make_page
from app.schemas.timetable import (
	TimetableCreate,
	TimetableDuplicateRequest,
	TimetableExceptionCreate,
	TimetableExceptionRead,
	TimetableGapRead,
	TimetableRead,
	TimetableUpdate,
)
from app.services.timetable_service import (
	create_timetable_exception,
	create_timetable_entry,
	delete_timetable_entry,
	delete_timetable_exception,
	duplicate_week,
	get_timetable_entry,
	list_timetable_entries,
	list_timetable_exceptions,
	timetable_gaps,
	update_timetable_entry,
)

router = APIRouter(prefix="/timetable", tags=["timetable"])

_DAYS_PATTERN = "^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$"


@router.get("", response_model=Page[TimetableRead])
def get_timetable(
	day: str | None = Query(default=None, pattern=_DAYS_PATTERN),
	semester_id: int | None = Query(default=None, ge=1),
	sort_order: Literal["asc", "desc"] = "asc",
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = list_timetable_entries(
		db, user.id, day, pagination.page, pagination.page_size, sort_order, semester_id,
	)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/gaps", response_model=list[TimetableGapRead])
def get_timetable_gaps(
	day: str | None = Query(default=None, pattern=_DAYS_PATTERN),
	semester_id: int | None = Query(default=None, ge=1),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return timetable_gaps(db, user.id, day, semester_id)


@router.post("/duplicate-week", response_model=list[TimetableRead])
def duplicate_timetable_week(
	data: TimetableDuplicateRequest,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return duplicate_week(db, user.id, data.target_semester_id)



@router.post("", response_model=TimetableRead, status_code=status.HTTP_201_CREATED)
def add_timetable_entry(data: TimetableCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return create_timetable_entry(db, user.id, data)


@router.get("/{entry_id}", response_model=TimetableRead)
def get_timetable_item(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_timetable_entry(db, user.id, entry_id)


@router.get("/{entry_id}/exceptions", response_model=list[TimetableExceptionRead])
def get_timetable_exceptions(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return list_timetable_exceptions(db, user.id, entry_id)


@router.post("/{entry_id}/exceptions", response_model=TimetableExceptionRead, status_code=status.HTTP_201_CREATED)
def add_timetable_exception(
	entry_id: int,
	data: TimetableExceptionCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return create_timetable_exception(db, user.id, entry_id, data)


@router.delete("/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_timetable_exception(
	exception_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
	delete_timetable_exception(db, user.id, exception_id)


@router.patch("/{entry_id}", response_model=TimetableRead)
def edit_timetable_entry(entry_id: int, data: TimetableUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return update_timetable_entry(db, user.id, entry_id, data)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_timetable_entry(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	delete_timetable_entry(db, user.id, entry_id)
