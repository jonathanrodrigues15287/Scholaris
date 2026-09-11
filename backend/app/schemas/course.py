from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
	name: str = Field(min_length=1, max_length=120)
	code: str = Field(min_length=1, max_length=30)
	credits: int = Field(default=0, ge=0)
	grade: float | None = Field(default=None, ge=0, le=10)
	semester_id: int | None = Field(default=None, ge=1)


class CourseRead(CourseCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
	updated_at: datetime | None = None


class CourseUpdate(BaseModel):
	name: str | None = Field(default=None, min_length=1, max_length=120)
	code: str | None = Field(default=None, min_length=1, max_length=30)
	credits: int | None = Field(default=None, ge=0)
	grade: float | None = Field(default=None, ge=0, le=10)
	semester_id: int | None = Field(default=None, ge=1)

