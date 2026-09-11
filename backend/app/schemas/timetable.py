from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimetableCreate(BaseModel):
	day: str = Field(pattern="^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$")
	start_time: time
	end_time: time
	room: str | None = Field(default=None, max_length=80)
	faculty: str | None = Field(default=None, max_length=120)
	recurrence_rule: str | None = Field(default=None, pattern="^weekly$")
	recurrence_until: date | None = None
	semester_id: int | None = None
	course_id: int

	@model_validator(mode="after")
	def validate_time_range(self):
		if self.end_time <= self.start_time:
			raise ValueError("end_time must be after start_time")
		return self


class TimetableRead(TimetableCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int


class TimetableUpdate(BaseModel):
	day: str | None = Field(default=None, pattern="^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$")
	start_time: time | None = None
	end_time: time | None = None
	room: str | None = Field(default=None, max_length=80)
	faculty: str | None = Field(default=None, max_length=120)
	recurrence_rule: str | None = Field(default=None, pattern="^weekly$")
	recurrence_until: date | None = None
	semester_id: int | None = None
	course_id: int | None = None

	@model_validator(mode="after")
	def validate_time_range(self):
		if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
			raise ValueError("end_time must be after start_time")
		return self


class TimetableExceptionCreate(BaseModel):
	exception_date: date
	status: str = Field(default="cancelled", pattern="^(cancelled|holiday|rescheduled)$")
	note: str | None = Field(default=None, max_length=255)


class TimetableExceptionRead(TimetableExceptionCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	timetable_id: int


class TimetableGapRead(BaseModel):
	day: str
	start_time: time
	end_time: time
	duration_minutes: int


class TimetableDuplicateRequest(BaseModel):
	target_semester_id: int | None = None

