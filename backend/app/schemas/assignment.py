from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AssignmentCreate(BaseModel):
	title: str = Field(min_length=1, max_length=200)
	description: str | None = Field(default=None, max_length=2000)
	due_date: date | None = None
	priority: str = Field(default="medium", pattern="^(high|medium|low)$")
	status: str = Field(default="pending", pattern="^(pending|in_progress|completed|submitted)$")
	priority_mode: str = Field(default="manual", pattern="^(manual|auto)$")
	course_id: int
	recurrence_rule: str | None = Field(default=None, pattern="^(daily|weekly|monthly)$")
	recurrence_until: date | None = None
	reminder_at: datetime | None = None
	attachment_name: str | None = Field(default=None, max_length=255)
	attachment_url: str | None = Field(default=None, max_length=2048)

	@model_validator(mode="after")
	def validate_recurrence_dates(self):
		if self.recurrence_until is not None and self.due_date is None:
			raise ValueError("recurrence_until requires a due_date")
		if self.due_date is not None and self.recurrence_until is not None and self.recurrence_until < self.due_date:
			raise ValueError("recurrence_until must be on or after due_date")
		return self


class AssignmentUpdate(BaseModel):
	title: str | None = Field(default=None, min_length=1, max_length=200)
	description: str | None = Field(default=None, max_length=2000)
	due_date: date | None = None
	status: str | None = Field(default=None, pattern="^(pending|in_progress|completed|submitted)$")
	priority: str | None = Field(default=None, pattern="^(high|medium|low)$")
	priority_mode: str | None = Field(default=None, pattern="^(manual|auto)$")
	course_id: int | None = None
	recurrence_rule: str | None = Field(default=None, pattern="^(daily|weekly|monthly)$")
	recurrence_until: date | None = None
	reminder_at: datetime | None = None
	attachment_name: str | None = Field(default=None, max_length=255)
	attachment_url: str | None = Field(default=None, max_length=2048)
	expected_updated_at: datetime | None = None

	@model_validator(mode="after")
	def validate_recurrence_dates(self):
		if self.due_date is not None and self.recurrence_until is not None and self.recurrence_until < self.due_date:
			raise ValueError("recurrence_until must be on or after due_date")
		return self


class AssignmentRead(AssignmentCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	is_completed: bool
	is_submitted: bool
	completed_at: datetime | None = None
	submitted_at: datetime | None = None
	updated_at: datetime | None = None


class AssignmentHistoryRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	event: str
	from_status: str | None
	to_status: str | None
	created_at: datetime

