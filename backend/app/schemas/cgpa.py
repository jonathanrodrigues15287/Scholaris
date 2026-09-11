from pydantic import BaseModel, Field


class GradeEntry(BaseModel):
	grade: float = Field(ge=0, le=10)
	credits: float = Field(gt=0)


class GpaResult(BaseModel):
	gpa: float
	total_credits: float


class GpaRequest(BaseModel):
	entries: list[GradeEntry] = Field(min_length=1, max_length=100)


class SemesterResult(BaseModel):
	semester: int = Field(ge=1)
	entries: list[GradeEntry]


class SemesterGpaResult(BaseModel):
	"""GPA result for a single semester, including its semester number."""
	semester: int
	gpa: float
	total_credits: float


class CgpaResult(BaseModel):
	"""Full CGPA response with cumulative GPA and per-semester breakdown."""
	gpa: float
	total_credits: float
	per_semester: list[SemesterGpaResult]


class CgpaRequest(BaseModel):
	semesters: list[SemesterResult] = Field(min_length=1, max_length=20)


class AcademicSemesterCreate(BaseModel):
	name: str = Field(min_length=1, max_length=80)
	semester_number: int | None = Field(default=None, ge=1)
	academic_year: str = Field(min_length=4, max_length=20)


class AcademicCourseCreate(BaseModel):
	name: str = Field(min_length=1, max_length=120)
	code: str = Field(min_length=1, max_length=30)
	credits: int = Field(gt=0, le=60)
	grade: float | None = Field(default=None, ge=0, le=10)


class AcademicCourseUpdate(BaseModel):
	name: str | None = Field(default=None, min_length=1, max_length=120)
	code: str | None = Field(default=None, min_length=1, max_length=30)
	credits: int | None = Field(default=None, gt=0, le=60)
	grade: float | None = Field(default=None, ge=0, le=10)


class AcademicCourseRead(BaseModel):
	model_config = {"from_attributes": True}

	id: int
	name: str
	code: str
	credits: int
	grade: float | None


class AcademicSemesterRead(BaseModel):
	id: int
	name: str
	semester_number: int | None
	academic_year: str
	courses: list[AcademicCourseRead]
	sgpa: float | None
	total_credits: int


class AcademicRecordResponse(BaseModel):
	cgpa: float | None
	total_credits: int
	semesters: list[AcademicSemesterRead]
	trend: list[SemesterGpaResult]


class TargetCgpaRequest(BaseModel):
	target_cgpa: float = Field(gt=0, le=10)
	next_semester_credits: int = Field(gt=0, le=60)


class TargetCgpaResult(BaseModel):
	current_cgpa: float | None
	target_cgpa: float
	next_semester_credits: int
	required_sgpa: float
	possible: bool


class WhatIfRequest(BaseModel):
	entries: list[GradeEntry] = Field(min_length=1, max_length=100)


class WhatIfResult(BaseModel):
	current_cgpa: float | None
	projected_cgpa: float
	added_credits: float
	semester_sgpa: float
