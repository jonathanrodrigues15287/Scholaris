from app.schemas.cgpa import CgpaResult, GpaResult, SemesterGpaResult, SemesterResult
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError
from app.models.course import Course
from app.models.semester import Semester
from app.schemas.cgpa import (
	AcademicCourseCreate,
	AcademicCourseUpdate,
	AcademicRecordResponse,
	AcademicSemesterCreate,
	AcademicSemesterRead,
	AcademicCourseRead,
	CgpaResult,
	GpaResult,
	SemesterGpaResult,
	SemesterResult,
	TargetCgpaRequest,
	TargetCgpaResult,
	WhatIfRequest,
	WhatIfResult,
)
from app.utils.helpers import normalise_code, normalise_name
from app.utils.validators import require_course, require_semester


def calculate_gpa(entries: list) -> GpaResult:
	total_credits = sum(entry.credits for entry in entries)
	weighted_points = sum(entry.grade * entry.credits for entry in entries)
	return GpaResult(
		gpa=round(weighted_points / total_credits, 2) if total_credits else 0.0,
		total_credits=total_credits,
	)


def _graded_courses(semester: Semester) -> list[Course]:
	return [course for course in semester.courses if course.deleted_at is None and course.grade is not None]


def _course_totals(courses: list[Course]) -> tuple[float, float]:
	return (
		sum(course.credits for course in courses),
		sum(course.credits * course.grade for course in courses if course.grade is not None),
	)


def get_academic_records(db: Session, owner_id: int) -> AcademicRecordResponse:
	semesters = db.scalars(
		select(Semester)
		.where(Semester.user_id == owner_id)
		.options(selectinload(Semester.courses))
		.order_by(Semester.semester_number, Semester.id)
	).all()
	semester_reads = []
	trend = []
	total_credits = 0.0
	total_weighted = 0.0
	for semester in semesters:
		graded = _graded_courses(semester)
		credits, weighted = _course_totals(graded)
		sgpa = round(weighted / credits, 2) if credits else None
		if sgpa is not None:
			trend.append(SemesterGpaResult(semester=semester.semester_number or semester.id, gpa=sgpa, total_credits=credits))
		semester_reads.append(
			AcademicSemesterRead(
				id=semester.id,
				name=semester.name,
				semester_number=semester.semester_number,
				academic_year=semester.academic_year,
				courses=[AcademicCourseRead.model_validate(course) for course in semester.courses if course.deleted_at is None],
				sgpa=sgpa,
				total_credits=int(credits),
			)
		)
		total_credits += credits
		total_weighted += weighted
	return AcademicRecordResponse(
		cgpa=round(total_weighted / total_credits, 2) if total_credits else None,
		total_credits=int(total_credits),
		semesters=semester_reads,
		trend=trend,
	)


def create_academic_semester(db: Session, owner_id: int, data: AcademicSemesterCreate) -> Semester:
	semester = Semester(user_id=owner_id, **data.model_dump())
	db.add(semester)
	db.commit()
	db.refresh(semester)
	return semester


def create_academic_course(db: Session, owner_id: int, semester_id: int, data: AcademicCourseCreate) -> Course:
	semester = require_semester(db, owner_id, semester_id)
	course = Course(
		user_id=owner_id,
		semester=semester,
		name=normalise_name(data.name),
		code=normalise_code(data.code),
		credits=data.credits,
		grade=data.grade,
	)
	db.add(course)
	db.commit()
	db.refresh(course)
	return course


def update_academic_course(db: Session, owner_id: int, course_id: int, data: AcademicCourseUpdate) -> Course:
	course = require_course(db, owner_id, course_id)
	if not course.semester_id:
		raise NotFoundError("Academic course not found")
	values = data.model_dump(exclude_unset=True)
	if "name" in values:
		values["name"] = normalise_name(values["name"])
	if "code" in values:
		values["code"] = normalise_code(values["code"])
	for key, value in values.items():
		setattr(course, key, value)
	db.commit()
	db.refresh(course)
	return course


def calculate_target(db: Session, owner_id: int, request: TargetCgpaRequest) -> TargetCgpaResult:
	records = get_academic_records(db, owner_id)
	current_credits = records.total_credits
	current_weighted = (records.cgpa or 0) * current_credits
	required = (request.target_cgpa * (current_credits + request.next_semester_credits) - current_weighted) / request.next_semester_credits
	required = round(required, 2)
	return TargetCgpaResult(
		current_cgpa=records.cgpa,
		target_cgpa=request.target_cgpa,
		next_semester_credits=request.next_semester_credits,
		required_sgpa=required,
		possible=0 <= required <= 10,
	)


def calculate_what_if(db: Session, owner_id: int, request: WhatIfRequest) -> WhatIfResult:
	records = get_academic_records(db, owner_id)
	current_credits = records.total_credits
	current_weighted = (records.cgpa or 0) * current_credits
	new = calculate_gpa(request.entries)
	projected_credits = current_credits + new.total_credits
	projected = (current_weighted + new.gpa * new.total_credits) / projected_credits if projected_credits else 0
	return WhatIfResult(
		current_cgpa=records.cgpa,
		projected_cgpa=round(projected, 2),
		added_credits=new.total_credits,
		semester_sgpa=new.gpa,
	)


def calculate_cgpa(semesters: list[SemesterResult]) -> CgpaResult:
	"""Return cumulative GPA plus a per-semester breakdown."""
	per_semester = [
		SemesterGpaResult(
			semester=sem.semester,
			gpa=calculate_gpa(sem.entries).gpa,
			total_credits=sum(e.credits for e in sem.entries),
		)
		for sem in semesters
	]
	all_entries = [entry for sem in semesters for entry in sem.entries]
	overall = calculate_gpa(all_entries)
	return CgpaResult(
		gpa=overall.gpa,
		total_credits=overall.total_credits,
		per_semester=per_semester,
	)
