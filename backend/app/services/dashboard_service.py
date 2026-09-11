from datetime import date, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.assignment import Assignment
from app.models.attendance import Attendance
from app.models.course import Course
from app.models.semester import Semester
from app.models.study_session import StudySession
from app.models.timetable import Timetable
from app.schemas.dashboard import (
	DashboardAcademicTrend,
	DashboardAssignment,
	DashboardAttendanceRisk,
	DashboardRecommendation,
	DashboardStudyConsistency,
	DashboardSummary,
	DashboardWorkload,
)
from app.utils.helpers import attendance_percentage
from app.services.attendance_service import _threshold as _fetch_threshold

_CRITICAL_ATTENDANCE_THRESHOLD = 60.0


def _assignment_read(assignment: Assignment, today: date) -> DashboardAssignment:
	return DashboardAssignment(
		id=assignment.id,
		title=assignment.title,
		due_date=assignment.due_date,
		priority=assignment.priority,
		course_id=assignment.course_id,
		days_until_due=(assignment.due_date - today).days if assignment.due_date else None,
	)


def get_dashboard(db: Session, owner_id: int) -> DashboardSummary:
	today = date.today()
	week_end = today + timedelta(days=7)
	active_filter = (
		Assignment.user_id == owner_id,
		Assignment.deleted_at.is_(None),
		Assignment.status.not_in(("completed", "submitted")),
		Course.deleted_at.is_(None),
	)
	pending_count = db.scalar(select(func.count(Assignment.id)).join(Course).where(*active_filter)) or 0
	upcoming = list(db.scalars(select(Assignment).join(Course).where(
		*active_filter, Assignment.due_date >= today, Assignment.due_date <= week_end,
	).order_by(Assignment.due_date, Assignment.priority).limit(10)))
	overdue = list(db.scalars(select(Assignment).join(Course).where(
		*active_filter, Assignment.due_date < today,
	).order_by(Assignment.due_date, Assignment.priority).limit(10)))
	completed_count, total_count = db.execute(select(
		func.sum(case((Assignment.status.in_(("completed", "submitted")), 1), else_=0)),
		func.count(Assignment.id),
	).join(Course).where(
		Assignment.user_id == owner_id,
		Assignment.deleted_at.is_(None),
		Course.deleted_at.is_(None),
	)).one()

	todays_classes = db.scalar(select(func.count(Timetable.id)).where(
		Timetable.course.has(Course.user_id == owner_id),
		Timetable.course.has(Course.deleted_at.is_(None)),
		Timetable.day == today.strftime("%A"),
	)) or 0
	present_total, total_attendance = db.execute(select(
		func.sum(case((Attendance.status == "present", 1), else_=0)),
		func.sum(case((Attendance.status.in_(("present", "absent")), 1), else_=0)),
	).where(
		Attendance.course.has(Course.user_id == owner_id),
		Attendance.course.has(Course.deleted_at.is_(None)),
	)).one()
	present_total = int(present_total or 0)
	total_attendance = int(total_attendance or 0)

	attendance_rows = db.execute(select(
		Attendance.course_id,
		Course.name,
		func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
		func.sum(case((Attendance.status == "absent", 1), else_=0)).label("absent"),
	).join(Course).where(
		Course.user_id == owner_id,
		Course.deleted_at.is_(None),
		Attendance.status.in_(("present", "absent")),
	).group_by(Attendance.course_id, Course.name)).all()
	low_attendance_threshold = _fetch_threshold(db, owner_id)
	attendance_risks = []
	for row in attendance_rows:
		present = int(row.present or 0)
		absent = int(row.absent or 0)
		total = present + absent
		if not total:
			continue
		percentage = attendance_percentage(present, total)
		level = "critical" if percentage < _CRITICAL_ATTENDANCE_THRESHOLD else "at_risk" if percentage < low_attendance_threshold else "safe"
		attendance_risks.append(DashboardAttendanceRisk(
			course_id=row.course_id, course_name=row.name, percentage=percentage,
			attended=present, total=total, level=level,
		))
	attendance_risks.sort(key=lambda item: item.percentage)

	study_minutes = int(db.scalar(select(func.coalesce(func.sum(StudySession.duration), 0)).where(
		StudySession.user_id == owner_id,
	)) or 0) // 60
	last_7_start = today - timedelta(days=6)
	study_days = db.execute(select(
		func.date(StudySession.start_time).label("session_date"),
		func.sum(StudySession.duration).label("seconds"),
	).where(
		StudySession.user_id == owner_id,
		StudySession.start_time >= last_7_start,
	).group_by(func.date(StudySession.start_time))).all()
	minutes_by_day = {
		(row.session_date if isinstance(row.session_date, date) else date.fromisoformat(str(row.session_date))): int(row.seconds or 0) // 60
		for row in study_days
	}
	active_days = sum(1 for minutes in minutes_by_day.values() if minutes > 0)
	minutes_last_7 = sum(minutes_by_day.values())
	streak = 0
	for offset in range(7):
		if minutes_by_day.get(today - timedelta(days=offset), 0) <= 0:
			break
		streak += 1
	consistency = DashboardStudyConsistency(
		active_days_last_7=active_days,
		minutes_last_7=minutes_last_7,
		average_minutes_per_active_day=round(minutes_last_7 / active_days) if active_days else 0,
		current_streak_days=streak,
	)

	workload_rows = db.execute(select(
		Assignment.priority,
		func.count(Assignment.id),
	).join(Course).where(*active_filter).group_by(Assignment.priority)).all()
	workload_counts = {"high": 0, "medium": 0, "low": 0, "undated": 0}
	for priority, count in workload_rows:
		workload_counts[priority] = int(count)
	workload_counts["undated"] = int(db.scalar(select(func.count(Assignment.id)).join(Course).where(
		*active_filter, Assignment.due_date.is_(None),
	)) or 0)
	workload = [DashboardWorkload(category=category, count=count) for category, count in workload_counts.items() if count]

	semesters = db.scalars(select(Semester).where(
		Semester.user_id == owner_id,
	).options(selectinload(Semester.courses)).order_by(Semester.semester_number, Semester.id)).all()
	academic_trend = []
	for semester in semesters:
		graded = [course for course in semester.courses if course.deleted_at is None and course.grade is not None and course.credits > 0]
		credits = sum(course.credits for course in graded)
		if credits:
			academic_trend.append(DashboardAcademicTrend(
				semester=semester.name,
				sgpa=round(sum(course.grade * course.credits for course in graded) / credits, 2),
			))

	attendance_score = attendance_percentage(present_total, total_attendance)
	deadline_score = int(completed_count or 0) / int(total_count or 1) * 100 if total_count else 100
	productivity_score = round(attendance_score * 0.35 + deadline_score * 0.35 + min(active_days / 5 * 100, 100) * 0.30)
	recommendations = []
	if overdue:
		recommendations.append(DashboardRecommendation(type="deadline", title="Clear overdue work", reason=f"At least {len(overdue)} assignment(s) are past their due date.", action="Open assignments"))
	if attendance_risks and attendance_risks[0].level != "safe":
		risk = attendance_risks[0]
		recommendations.append(DashboardRecommendation(type="attendance", title=f"Protect {risk.course_name}", reason=f"Attendance is {risk.percentage:.1f}% ({risk.attended}/{risk.total}).", action="Review attendance"))
	if upcoming:
		recommendations.append(DashboardRecommendation(type="deadline", title=f"Prepare {upcoming[0].title}", reason=f"Due in {max((upcoming[0].due_date - today).days, 0)} day(s).", action="Start a study session"))
	if active_days < 3:
		recommendations.append(DashboardRecommendation(type="consistency", title="Rebuild study consistency", reason=f"Only {active_days} active study day(s) in the last week.", action="Start a 25-minute session"))

	return DashboardSummary(
		todays_classes=int(todays_classes),
		pending_assignments=int(pending_count),
		upcoming_assignments=len(upcoming),
		overdue_assignments=len(overdue),
		low_attendance_courses=sum(1 for risk in attendance_risks if risk.level != "safe"),
		attendance_percentage=attendance_score,
		study_minutes=study_minutes,
		due_soon=[_assignment_read(item, today) for item in upcoming],
		overdue=[_assignment_read(item, today) for item in overdue],
		attendance_risks=attendance_risks,
		study_consistency=consistency,
		workload=workload,
		academic_trend=academic_trend,
		productivity_score=productivity_score,
		recommendations=recommendations[:5],
	)
