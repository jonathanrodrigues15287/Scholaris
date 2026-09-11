from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import PaginationParams, get_current_user
from app.schemas.attendance import (
	AttendanceCreate,
	AttendanceHistoryRead,
	AttendancePrediction,
	AttendanceRead,
	AttendanceSummary,
	AttendanceThresholdRead,
	AttendanceThresholdUpdate,
	AttendanceTrend,
	AttendanceUpdate,
)
from app.schemas.common import Page, make_page
from app.services.attendance_service import (
	attendance_summary,
	attendance_predictions,
	attendance_trends,
	create_attendance,
	delete_attendance,
	get_attendance as get_attendance_record,
	list_attendance,
	list_attendance_history,
	get_attendance_threshold,
	update_attendance_threshold,
	update_attendance,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("", response_model=Page[AttendanceRead])
def get_attendance(
	course_id: int | None = Query(default=None, ge=1),
	status: Literal["present", "absent"] | None = None,
	date_from: date | None = None,
	date_to: date | None = None,
	sort_order: Literal["asc", "desc"] = "desc",
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = list_attendance(
		db, user.id, course_id, status, date_from, date_to,
		pagination.page, pagination.page_size, sort_order,
	)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/summary", response_model=Page[AttendanceSummary])
def get_attendance_summary(
	course_id: int | None = Query(default=None, ge=1),
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = attendance_summary(
		db, user.id, course_id, pagination.page, pagination.page_size,
	)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/stats/subjects", response_model=Page[AttendanceSummary])
def get_subject_attendance_stats(
	course_id: int | None = Query(default=None, ge=1),
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = attendance_summary(db, user.id, course_id, pagination.page, pagination.page_size)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/stats/predictions", response_model=list[AttendancePrediction])
def get_attendance_predictions(
	course_id: int | None = Query(default=None, ge=1),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return attendance_predictions(db, user.id, course_id)


@router.get("/stats/trends", response_model=list[AttendanceTrend])
def get_attendance_trends(
	period: Literal["month", "semester"] = "month",
	course_id: int | None = Query(default=None, ge=1),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return attendance_trends(db, user.id, period, course_id)


@router.get("/threshold", response_model=AttendanceThresholdRead)
def get_attendance_threshold_setting(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return {"minimum_attendance_threshold": get_attendance_threshold(db, user.id)}


@router.patch("/threshold", response_model=AttendanceThresholdRead)
def set_attendance_threshold(
	data: AttendanceThresholdUpdate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return {"minimum_attendance_threshold": update_attendance_threshold(
		db, user.id, data.minimum_attendance_threshold
	)}


@router.get("/{record_id}/history", response_model=list[AttendanceHistoryRead])
def get_attendance_record_history(
	record_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return list_attendance_history(db, user.id, record_id)


@router.get("/{record_id}", response_model=AttendanceRead)
def get_attendance_item(record_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_attendance_record(db, user.id, record_id)


@router.post("", response_model=AttendanceRead, status_code=status.HTTP_201_CREATED)
def add_attendance(data: AttendanceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return create_attendance(db, user.id, data)


@router.patch("/{record_id}", response_model=AttendanceRead)
def edit_attendance(record_id: int, data: AttendanceUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return update_attendance(db, user.id, record_id, data)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_attendance(record_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	delete_attendance(db, user.id, record_id)
