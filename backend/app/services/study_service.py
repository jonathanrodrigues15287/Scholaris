from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models.course import Course
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.study_session import (
	StudyGoalRead,
	StudyGoalUpdate,
	StudyPeriod,
	StudySessionCreate,
	StudySessionUpdate,
	StudyStats,
	StudySuggestion,
	StudyTrend,
)
from app.utils.helpers import apply_partial_update
from app.utils.pagination import fetch_page
from app.utils.validators import require_assignment_for_user, require_course, require_study_session


def list_sessions(
	db: Session,
	owner_id: int,
	course_id: int | None = None,
	assignment_id: int | None = None,
	page: int = 1,
	page_size: int = 20,
	sort_order: str = "desc",
) -> tuple[list[StudySession], int]:
	query = select(StudySession).where(StudySession.user_id == owner_id)
	if course_id is not None:
		query = query.where(StudySession.course_id == course_id)
	if assignment_id is not None:
		query = query.where(StudySession.assignment_id == assignment_id)
	order = StudySession.start_time.desc() if sort_order == "desc" else StudySession.start_time.asc()
	return fetch_page(query.order_by(order), db, page, page_size)


def create_session(db: Session, owner_id: int, data: StudySessionCreate) -> StudySession:
	assignment = None
	if data.course_id is not None:
		require_course(db, owner_id, data.course_id)
	if data.assignment_id is not None:
		assignment = require_assignment_for_user(db, owner_id, data.assignment_id)
	if assignment is not None and data.course_id != assignment.course_id:
		raise ConflictError("Study session course must match the assignment course")
	session = StudySession(**data.model_dump(), user_id=owner_id)
	db.add(session)
	db.commit()
	db.refresh(session)
	return session


def get_session(db: Session, owner_id: int, session_id: int) -> StudySession:
	return require_study_session(db, owner_id, session_id)


def update_session(db: Session, owner_id: int, session_id: int, data: StudySessionUpdate) -> StudySession:
	session = require_study_session(db, owner_id, session_id)
	values = data.model_dump(exclude_unset=True)
	course_id = values.get("course_id", session.course_id)
	assignment_id = values.get("assignment_id", session.assignment_id)
	if "course_id" in values and values["course_id"] is not None:
		require_course(db, owner_id, values["course_id"])
	assignment = None
	if assignment_id is not None:
		assignment = require_assignment_for_user(db, owner_id, assignment_id)
	if assignment is not None and course_id != assignment.course_id:
		raise ConflictError("Study session course must match the assignment course")
	apply_partial_update(session, values)
	db.commit()
	db.refresh(session)
	return session


def delete_session(db: Session, owner_id: int, session_id: int) -> None:
	session = require_study_session(db, owner_id, session_id)
	db.delete(session)
	db.commit()


def study_stats(db: Session, owner_id: int) -> StudyStats:
	today = date.today()
	rows = list(db.scalars(select(StudySession).where(StudySession.user_id == owner_id)))
	minutes_by_date: dict[date, int] = {}
	for row in rows:
		row_date = row.start_time.date()
		minutes_by_date[row_date] = minutes_by_date.get(row_date, 0) + row.duration // 60
	goal = db.scalar(select(User.weekly_study_goal_minutes).where(User.id == owner_id)) or 300
	weekly_start = today - timedelta(days=today.weekday())
	daily = minutes_by_date.get(today, 0)
	weekly = sum(value for row_date, value in minutes_by_date.items() if weekly_start <= row_date <= today)
	monthly = sum(value for row_date, value in minutes_by_date.items() if row_date.year == today.year and row_date.month == today.month)
	streak = 0
	check_date = today
	while minutes_by_date.get(check_date, 0) > 0:
		streak += 1
		check_date -= timedelta(days=1)
	trend = [StudyTrend(date=(today - timedelta(days=offset)).isoformat(), minutes=minutes_by_date.get(today - timedelta(days=offset), 0)) for offset in range(29, -1, -1)]
	return StudyStats(
		daily=daily,
		weekly=weekly,
		monthly=monthly,
		streak_days=streak,
		goal_minutes=goal,
		goal_progress_minutes=weekly,
		periods=[StudyPeriod(period="today", minutes=daily), StudyPeriod(period="week", minutes=weekly), StudyPeriod(period="month", minutes=monthly)],
		trend=trend,
	)


def get_study_goal(db: Session, owner_id: int) -> StudyGoalRead:
	return StudyGoalRead(weekly_study_goal_minutes=db.scalar(select(User.weekly_study_goal_minutes).where(User.id == owner_id)) or 300)


def update_study_goal(db: Session, owner_id: int, data: StudyGoalUpdate) -> StudyGoalRead:
	user = db.get(User, owner_id)
	user.weekly_study_goal_minutes = data.weekly_study_goal_minutes
	db.commit()
	return get_study_goal(db, owner_id)


def study_suggestions(db: Session, owner_id: int) -> list[StudySuggestion]:
	from app.models.assignment import Assignment
	from app.models.attendance import Attendance
	from app.models.course import Course
	from app.models.timetable import Timetable

	today = date.today()
	suggestions: list[StudySuggestion] = []
	assignments = db.scalars(
		select(Assignment).where(
			Assignment.user_id == owner_id,
			Assignment.deleted_at.is_(None),
			Assignment.status.not_in(("completed", "submitted")),
			Assignment.due_date.is_not(None),
		).order_by(Assignment.due_date, Assignment.priority)
	).all()
	for assignment in assignments[:3]:
		days = max((assignment.due_date - today).days, 0)
		suggestions.append(StudySuggestion(type="deadline", title=assignment.title, reason=f"Due in {days} day(s)", course_id=assignment.course_id, assignment_id=assignment.id, duration_minutes=25))
	low_attendance = db.execute(
		select(Course.id, Course.name, func.sum(case((Attendance.status == "present", 1), else_=0)), func.count(Attendance.id))
		.join(Attendance, Attendance.course_id == Course.id).where(Course.user_id == owner_id).group_by(Course.id, Course.name)
	).all()
	for course_id, name, present, total in low_attendance:
		if total and (present or 0) / total < 0.75:
			suggestions.append(StudySuggestion(type="attendance", title=name, reason="Attendance is below 75%", course_id=course_id, duration_minutes=25))
	entries = db.scalars(
		select(Timetable).join(Course).where(Course.user_id == owner_id, Course.deleted_at.is_(None))
	).all()
	for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday"):
		day_entries = sorted((entry for entry in entries if entry.day == day), key=lambda entry: entry.start_time)
		for previous, current in zip(day_entries, day_entries[1:]):
			gap = int((datetime.combine(today, current.start_time) - datetime.combine(today, previous.end_time)).total_seconds() // 60)
			if gap >= 25:
				suggestions.append(StudySuggestion(type="free_slot", title=f"Study block on {day}", reason=f"Free from {previous.end_time.strftime('%H:%M')} to {current.start_time.strftime('%H:%M')}", duration_minutes=min(gap, 50)))
				break
	return suggestions[:5]
