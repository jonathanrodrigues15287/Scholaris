from datetime import date
from math import ceil, floor

from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.attendance import Attendance, AttendanceHistory
from app.models.course import Course
from app.models.semester import Semester
from app.models.user import User
from app.core.exceptions import ConflictError
from app.schemas.attendance import (
	AttendanceCreate,
	AttendancePrediction,
	AttendanceSummary,
	AttendanceTrend,
	AttendanceUpdate,
)
from app.utils.helpers import apply_partial_update, attendance_percentage
from app.utils.pagination import fetch_page
from app.utils.validators import require_attendance, require_course


def list_attendance(
	db: Session,
	owner_id: int,
	course_id: int | None = None,
	status: str | None = None,
	date_from: date | None = None,
	date_to: date | None = None,
	page: int = 1,
	page_size: int = 20,
	sort_order: str = "desc",
) -> tuple[list[Attendance], int]:
	query = select(Attendance).join(Course).where(
		Course.user_id == owner_id,
		Course.deleted_at.is_(None),
	)
	if course_id is not None:
		query = query.where(Attendance.course_id == course_id)
	if status is not None:
		query = query.where(Attendance.status == status)
	if date_from is not None:
		query = query.where(Attendance.date >= date_from)
	if date_to is not None:
		query = query.where(Attendance.date <= date_to)
	order = Attendance.date.desc() if sort_order == "desc" else Attendance.date.asc()
	return fetch_page(query.order_by(order, Attendance.id), db, page, page_size)


def get_attendance(db: Session, owner_id: int, record_id: int) -> Attendance:
	return require_attendance(db, owner_id, record_id)


def create_attendance(db: Session, owner_id: int, data: AttendanceCreate) -> Attendance:
	require_course(db, owner_id, data.course_id)
	if data.semester_id is not None:
		require_semester(db, owner_id, data.semester_id)
	record = db.scalar(
		select(Attendance).join(Course).where(
			Course.user_id == owner_id,
			Attendance.course_id == data.course_id,
			Attendance.date == data.date,
		)
	)
	if record:
		raise ConflictError("Attendance already exists for this course and date")
	record = Attendance(**data.model_dump())
	db.add(record)
	try:
		db.flush()
		_record_history(db, record, owner_id, "created", None, record.status)
		db.commit()
	except IntegrityError as error:
		db.rollback()
		raise ConflictError("Attendance already exists for this course and date") from error
	db.refresh(record)
	return record


def update_attendance(db: Session, owner_id: int, record_id: int, data: AttendanceUpdate) -> Attendance:
	record = require_attendance(db, owner_id, record_id)
	values = data.model_dump(exclude_unset=True)
	previous = (record.course_id, record.semester_id, record.date, record.status)
	if "course_id" in values:
		require_course(db, owner_id, values["course_id"])
	if "semester_id" in values and values["semester_id"] is not None:
		require_semester(db, owner_id, values["semester_id"])
	if "course_id" in values or "date" in values:
		course_id = values.get("course_id", record.course_id)
		record_date = values.get("date", record.date)
		duplicate = db.scalar(
			select(Attendance).join(Course).where(
				Course.user_id == owner_id,
				Attendance.course_id == course_id,
				Attendance.date == record_date,
				Attendance.id != record_id,
			)
		)
		if duplicate:
			raise ConflictError("Attendance already exists for this course and date")
	apply_partial_update(record, values)
	try:
		_record_history(db, record, owner_id, "updated", previous[3], record.status)
		db.commit()
	except IntegrityError as error:
		db.rollback()
		raise ConflictError("Attendance already exists for this course and date") from error
	db.refresh(record)
	return record


def delete_attendance(db: Session, owner_id: int, record_id: int) -> None:
	record = require_attendance(db, owner_id, record_id)
	_record_history(db, record, owner_id, "deleted", record.status, None)
	db.delete(record)
	db.commit()


def require_semester(db: Session, owner_id: int, semester_id: int) -> Semester:
	semester = db.scalar(select(Semester).where(Semester.id == semester_id, Semester.user_id == owner_id))
	if not semester:
		raise ConflictError("Semester does not belong to the current user")
	return semester


def _record_history(
	db: Session,
	record: Attendance,
	owner_id: int,
	event: str,
	from_status: str | None,
	to_status: str | None,
) -> None:
	db.add(
		AttendanceHistory(
			attendance_id=record.id,
			user_id=owner_id,
			course_id=record.course_id,
			semester_id=record.semester_id,
			date=record.date,
			event=event,
			from_status=from_status,
			to_status=to_status,
		)
	)


def list_attendance_history(db: Session, owner_id: int, record_id: int) -> list[AttendanceHistory]:
	require_attendance(db, owner_id, record_id)
	return list(db.scalars(
		select(AttendanceHistory)
		.where(AttendanceHistory.user_id == owner_id, AttendanceHistory.attendance_id == record_id)
		.order_by(AttendanceHistory.created_at.desc(), AttendanceHistory.id.desc())
	))


def _prediction(present: int, absent: int, threshold: float) -> tuple[float, bool, str, int | None, int | None]:
	total = present + absent
	percentage = attendance_percentage(present, total)
	margin = percentage - threshold
	warning = percentage < threshold or (threshold > 0 and margin <= 5)
	warning_level = "below" if percentage < threshold else "approaching" if threshold > 0 and margin <= 5 else "safe"
	if percentage < threshold:
		attend_next = None if threshold >= 100 else max(1, ceil((threshold * total - present * 100) / (100 - threshold)))
		return percentage, warning, warning_level, attend_next, None
	maximum_misses = floor((present * 100 / threshold - total) + 1e-9) if threshold > 0 else None
	return percentage, warning, warning_level, None, max(0, maximum_misses) if maximum_misses is not None else None


def _threshold(db: Session, owner_id: int) -> float:
	return float(db.scalar(select(User.minimum_attendance_threshold).where(User.id == owner_id)) or 75.0)


def attendance_summary(
	db: Session,
	owner_id: int,
	course_id: int | None = None,
	page: int = 1,
	page_size: int = 20,
) -> tuple[list[AttendanceSummary], int]:
	# Count each status with a portable SQL CASE expression.
	query = (
		select(
			Attendance.course_id,
			Course.name.label("course_name"),
			Course.code.label("course_code"),
			func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
			func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
		)
		.join(Course)
		.where(Course.user_id == owner_id, Course.deleted_at.is_(None))
		.group_by(Attendance.course_id)
	)
	if course_id is not None:
		query = query.where(Attendance.course_id == course_id)
	result_count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
	threshold = _threshold(db, owner_id)
	results = []
	for row in db.execute(query.offset((page - 1) * page_size).limit(page_size)):
		present = int(row.present or 0)
		absent = int(row.absent or 0)
		percentage, warning, warning_level, attend_next, safe_absences = _prediction(present, absent, threshold)
		results.append(AttendanceSummary(
			course_id=row.course_id,
			course_name=row.course_name,
			course_code=row.course_code,
			present=present,
			absent=absent,
			percentage=percentage,
			threshold=threshold,
			warning=warning,
			warning_level=warning_level,
			attend_next=attend_next,
			safe_absences=safe_absences,
		))
	return results, result_count


def attendance_predictions(
	db: Session, owner_id: int, course_id: int | None = None
) -> list[AttendancePrediction]:
	summaries, _ = attendance_summary(db, owner_id, course_id, 1, 1000)
	return [
		AttendancePrediction(
			course_id=summary.course_id,
			percentage=summary.percentage,
			threshold=summary.threshold,
			warning=summary.warning,
			warning_level=summary.warning_level,
			attend_next=summary.attend_next,
			safe_absences=summary.safe_absences,
		)
		for summary in summaries
	]


def attendance_trends(
	db: Session,
	owner_id: int,
	period: str,
	course_id: int | None = None,
) -> list[AttendanceTrend]:
	query = (
		select(Attendance.date, Attendance.status, Attendance.semester_id)
		.join(Course)
		.where(Course.user_id == owner_id, Course.deleted_at.is_(None))
	)
	if course_id is not None:
		query = query.where(Attendance.course_id == course_id)
	groups: dict[str, list[int]] = {}
	for record_date, status, semester_id in db.execute(query.order_by(Attendance.date)):
		if period == "month":
			key = record_date.strftime("%Y-%m")
		else:
			key = f"semester:{semester_id}" if semester_id is not None else "semester:unassigned"
		counts = groups.setdefault(key, [0, 0])
		if status in ("present", "absent"):
			counts[0 if status == "present" else 1] += 1
	return [
		AttendanceTrend(
			period=key,
			present=counts[0],
			absent=counts[1],
			percentage=attendance_percentage(counts[0], sum(counts)),
		)
		for key, counts in groups.items()
	]


def get_attendance_threshold(db: Session, owner_id: int) -> float:
	return _threshold(db, owner_id)


def update_attendance_threshold(db: Session, owner_id: int, threshold: float) -> float:
	user = db.get(User, owner_id)
	if user is None:
		raise ConflictError("User not found")
	user.minimum_attendance_threshold = threshold
	db.commit()
	db.refresh(user)
	return float(user.minimum_attendance_threshold)

