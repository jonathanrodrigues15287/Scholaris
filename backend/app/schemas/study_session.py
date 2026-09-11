from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StudySessionCreate(BaseModel):
	start_time: datetime
	duration: int = Field(gt=0)
	course_id: int | None = None
	assignment_id: int | None = None


class StudySessionRead(StudySessionCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	updated_at: datetime | None = None


class StudySessionUpdate(BaseModel):
	start_time: datetime | None = None
	duration: int | None = Field(default=None, gt=0)
	course_id: int | None = None
	assignment_id: int | None = None


class StudyPeriod(BaseModel):
	period: str
	minutes: int


class StudyTrend(BaseModel):
	date: str
	minutes: int


class StudyStats(BaseModel):
	daily: int
	weekly: int
	monthly: int
	streak_days: int
	goal_minutes: int
	goal_progress_minutes: int
	periods: list[StudyPeriod]
	trend: list[StudyTrend]


class StudyGoalUpdate(BaseModel):
	weekly_study_goal_minutes: int = Field(ge=1, le=10080)


class StudyGoalRead(BaseModel):
	weekly_study_goal_minutes: int


class StudySuggestion(BaseModel):
	type: str
	title: str
	reason: str
	course_id: int | None = None
	assignment_id: int | None = None
	duration_minutes: int

