from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
	name: str = Field(min_length=1, max_length=120)
	code: str = Field(min_length=1, max_length=30)
	credits: int = Field(default=0, ge=0)


class CourseRead(CourseCreate):
	model_config = ConfigDict(from_attributes=True)

	id: int
