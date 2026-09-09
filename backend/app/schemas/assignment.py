from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class AssignmentCreate(BaseModel):
	title: str = Field(min_length=1, max_length=200)
	description: str | None = Field(default=None, max_length=2000)
	due_date: date | None = None
	priority: str = Field(default="medium", pattern="^(high|medium|low)$")
	status: str = Field(default="pending", pattern="^(pending|in_progress|completed|submitted)$")
	priority_mode: str = Field(default="manual", pattern="^(manual|auto)$")
	course_id: int


class AssignmentUpdate(BaseModel):
	is_completed: bool | None = None
	is_submitted: bool | None = None
	priority: str | None = Field(default=None, pattern="^(high|medium|low)$")
	status: str | None = Field(default=None, pattern="^(pending|in_progress|completed|submitted)$")


class AssignmentRead(AssignmentCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	is_completed: bool
	is_submitted: bool
