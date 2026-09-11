from datetime import date

from pydantic import BaseModel, ConfigDict


class DashboardAssignment(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	title: str
	due_date: date | None
	priority: str
	course_id: int
	days_until_due: int | None = None


class DashboardAttendanceRisk(BaseModel):
	course_id: int
	course_name: str
	percentage: float
	attended: int
	total: int
	level: str


class DashboardWorkload(BaseModel):
	category: str
	count: int


class DashboardAcademicTrend(BaseModel):
	semester: str
	sgpa: float


class DashboardRecommendation(BaseModel):
	type: str
	title: str
	reason: str
	action: str


class DashboardStudyConsistency(BaseModel):
	active_days_last_7: int
	minutes_last_7: int
	average_minutes_per_active_day: int
	current_streak_days: int


class DashboardSummary(BaseModel):
	todays_classes: int
	pending_assignments: int           # all unfinished assignments, including undated and overdue
	upcoming_assignments: int          # unfinished assignments due today through the next 7 days
	overdue_assignments: int           # unfinished assignments with a due date before today
	low_attendance_courses: int
	attendance_percentage: float
	study_minutes: int
	due_soon: list[DashboardAssignment]
	overdue: list[DashboardAssignment]
	attendance_risks: list[DashboardAttendanceRisk]
	study_consistency: DashboardStudyConsistency
	workload: list[DashboardWorkload]
	academic_trend: list[DashboardAcademicTrend]
	productivity_score: int
	recommendations: list[DashboardRecommendation]
