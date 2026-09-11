from datetime import date, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models.course import Course
from app.models.timetable import Timetable, TimetableException
from app.schemas.timetable import TimetableCreate, TimetableExceptionCreate, TimetableUpdate
from app.utils.pagination import fetch_page
from app.utils.helpers import apply_partial_update
from app.utils.validators import require_course, require_semester, require_timetable_entry, validate_timetable_times


def list_timetable_entries(
	db: Session,
	owner_id: int,
	day: str | None = None,
	page: int = 1,
	page_size: int = 20,
	sort_order: str = "asc",
	semester_id: int | None = None,
) -> tuple[list[Timetable], int]:
	query = select(Timetable).join(Course).where(
		Course.user_id == owner_id,
		Course.deleted_at.is_(None),
	)
	if day:
		query = query.where(Timetable.day == day)
	if semester_id is not None:
		query = query.where(Timetable.semester_id == semester_id)
	order = Timetable.start_time.asc() if sort_order == "asc" else Timetable.start_time.desc()
	return fetch_page(query.order_by(Timetable.day, order), db, page, page_size)


def create_timetable_entry(db: Session, owner_id: int, data: TimetableCreate) -> Timetable:
	require_course(db, owner_id, data.course_id)
	if data.semester_id is not None:
		require_semester(db, owner_id, data.semester_id)
	validate_timetable_times(data.start_time, data.end_time)
	if has_conflict(db, owner_id, data.day, data.start_time, data.end_time, semester_id=data.semester_id):
		raise ConflictError("Timetable entry conflicts with an existing class")
	entry = Timetable(**data.model_dump())
	db.add(entry)
	db.commit()
	db.refresh(entry)
	return entry


def get_timetable_entry(db: Session, owner_id: int, entry_id: int) -> Timetable:
	return require_timetable_entry(db, owner_id, entry_id)



def has_conflict(
	db: Session,
	owner_id: int,
	day: str,
	start_time,
	end_time,
	exclude_id: int | None = None,
	semester_id: int | None = None,
) -> bool:
	"""
	Return True if [start_time, end_time) on *day* overlaps any existing entry.

	*exclude_id* is used during updates to skip the entry being edited.
	The function now accepts scalar arguments rather than a schema object so
	callers that have partially-applied values (e.g. PATCH with only start_time)
	can merge current DB values before calling.
	"""
	query = (
		select(Timetable)
		.join(Course)
		.where(
			Course.user_id == owner_id,
			Timetable.day == day,
			Course.deleted_at.is_(None),
		)
	)
	if semester_id is not None:
		query = query.where(or_(Timetable.semester_id == semester_id, Timetable.semester_id.is_(None)))
	if exclude_id is not None:
		query = query.where(Timetable.id != exclude_id)
	for existing in db.scalars(query):
		if start_time < existing.end_time and end_time > existing.start_time:
			return True
	return False


def update_timetable_entry(db: Session, owner_id: int, entry_id: int, data: TimetableUpdate) -> Timetable:
	entry = require_timetable_entry(db, owner_id, entry_id)
	values = data.model_dump(exclude_unset=True)
	if "course_id" in values:
		require_course(db, owner_id, values["course_id"])
	if "semester_id" in values and values["semester_id"] is not None:
		require_semester(db, owner_id, values["semester_id"])

	# Apply the patch in memory so we can validate the resulting state.
	apply_partial_update(entry, values)

	# Validate times using the fully-merged (current + patched) values.
	validate_timetable_times(entry.start_time, entry.end_time)

	# Conflict check uses merged values — fixes V2 where omitting 'day' in the
	# PATCH body would cause has_conflict to query WHERE day = NULL.
	if has_conflict(
		db, owner_id, entry.day, entry.start_time, entry.end_time,
		exclude_id=entry.id, semester_id=entry.semester_id,
	):
		raise ConflictError("Timetable entry conflicts with an existing class")

	db.commit()
	db.refresh(entry)
	return entry


def delete_timetable_entry(db: Session, owner_id: int, entry_id: int) -> None:
	entry = require_timetable_entry(db, owner_id, entry_id)
	db.delete(entry)
	db.commit()


def duplicate_week(db: Session, owner_id: int, target_semester_id: int | None = None) -> list[Timetable]:
	if target_semester_id is not None:
		require_semester(db, owner_id, target_semester_id)
	entries = list(
		db.scalars(
			select(Timetable)
			.join(Course)
			.where(Course.user_id == owner_id, Course.deleted_at.is_(None))
		)
	)
	created = []
	for entry in entries:
		semester_id = target_semester_id if target_semester_id is not None else entry.semester_id
		if has_conflict(
			db, owner_id, entry.day, entry.start_time, entry.end_time,
			semester_id=semester_id,
		):
			continue
		copy = Timetable(
			day=entry.day,
			start_time=entry.start_time,
			end_time=entry.end_time,
			room=entry.room,
			faculty=entry.faculty,
			recurrence_rule=entry.recurrence_rule,
			recurrence_until=entry.recurrence_until,
			semester_id=semester_id,
			course_id=entry.course_id,
		)
		db.add(copy)
		created.append(copy)
	db.flush()
	db.commit()
	for entry in created:
		db.refresh(entry)
	return created


def create_timetable_exception(
	db: Session, owner_id: int, entry_id: int, data: TimetableExceptionCreate
) -> TimetableException:
	entry = require_timetable_entry(db, owner_id, entry_id)
	exception = TimetableException(
		timetable_id=entry.id,
		exception_date=data.exception_date,
		status=data.status,
		note=data.note,
	)
	db.add(exception)
	try:
		db.commit()
	except Exception as error:
		db.rollback()
		raise ConflictError("A timetable exception already exists for this date") from error
	db.refresh(exception)
	return exception


def list_timetable_exceptions(db: Session, owner_id: int, entry_id: int) -> list[TimetableException]:
	require_timetable_entry(db, owner_id, entry_id)
	return list(db.scalars(
		select(TimetableException)
		.join(Timetable)
		.join(Course)
		.where(Course.user_id == owner_id, TimetableException.timetable_id == entry_id)
		.order_by(TimetableException.exception_date)
	))


def delete_timetable_exception(db: Session, owner_id: int, exception_id: int) -> None:
	exception = db.scalar(
		select(TimetableException).join(Timetable).join(Course).where(
			TimetableException.id == exception_id,
			Course.user_id == owner_id,
		)
	)
	if not exception:
		raise ConflictError("Timetable exception not found")
	db.delete(exception)
	db.commit()


def timetable_gaps(
	db: Session, owner_id: int, day: str | None = None, semester_id: int | None = None
) -> list[dict]:
	entries, _ = list_timetable_entries(
		db, owner_id, day, 1, 1000, "asc", semester_id,
	)
	by_day: dict[str, list[Timetable]] = {}
	for entry in entries:
		by_day.setdefault(entry.day, []).append(entry)
	gaps = []
	for entry_day, day_entries in by_day.items():
		ordered = sorted(day_entries, key=lambda item: item.start_time)
		for previous, current in zip(ordered, ordered[1:]):
			start = datetime.combine(date.today(), previous.end_time)
			end = datetime.combine(date.today(), current.start_time)
			minutes = int((end - start).total_seconds() // 60)
			if minutes > 0:
				gaps.append({"day": entry_day, "start_time": previous.end_time, "end_time": current.start_time, "duration_minutes": minutes})
	return gaps

