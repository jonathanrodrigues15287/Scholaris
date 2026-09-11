from datetime import date as date_type, datetime

from pydantic import BaseModel, ConfigDict, Field


class AttendanceCreate(BaseModel):
	course_id: int
	semester_id: int | None = None
	date: date_type
	status: str = Field(pattern="^(present|absent|holiday|exam)$")


class AttendanceRead(AttendanceCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	updated_at: datetime | None = None


class AttendanceUpdate(BaseModel):
	course_id: int | None = None
	semester_id: int | None = None
	date: date_type | None = None
	status: str | None = Field(default=None, pattern="^(present|absent|holiday|exam)$")


class AttendanceSummary(BaseModel):
	course_id: int
	course_name: str | None = None
	course_code: str | None = None
	present: int
	absent: int
	percentage: float
	threshold: float
	warning: bool
	warning_level: str
	attend_next: int | None = None
	safe_absences: int | None = None


class AttendancePrediction(BaseModel):
	course_id: int
	percentage: float
	threshold: float
	warning: bool
	warning_level: str
	attend_next: int | None = None
	safe_absences: int | None = None


class AttendanceTrend(BaseModel):
	period: str
	present: int
	absent: int
	percentage: float


class AttendanceHistoryRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	attendance_id: int | None
	course_id: int
	semester_id: int | None
	date: date_type
	event: str
	from_status: str | None
	to_status: str | None
	created_at: datetime


class AttendanceThresholdUpdate(BaseModel):
	minimum_attendance_threshold: float = Field(ge=0, le=100)


class AttendanceThresholdRead(BaseModel):
	minimum_attendance_threshold: float

