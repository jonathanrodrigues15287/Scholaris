from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.cgpa import (
	AcademicCourseCreate,
	AcademicCourseRead,
	AcademicCourseUpdate,
	AcademicRecordResponse,
	AcademicSemesterCreate,
	AcademicSemesterRead,
	CgpaRequest,
	CgpaResult,
	GpaRequest,
	GpaResult,
	TargetCgpaRequest,
	TargetCgpaResult,
	WhatIfRequest,
	WhatIfResult,
)
from app.services.cgpa_service import (
	calculate_cgpa,
	calculate_gpa,
	calculate_target,
	calculate_what_if,
	create_academic_course,
	create_academic_semester,
	get_academic_records,
	update_academic_course,
)

router = APIRouter(prefix="/cgpa", tags=["cgpa"])


@router.post("/sgpa", response_model=GpaResult, summary="Calculate SGPA for a single semester")
def calculate_sgpa(request: GpaRequest):
	"""Calculate Semester GPA from a list of course grades and credits."""
	return calculate_gpa(request.entries)


@router.post("/cgpa", response_model=CgpaResult, summary="Calculate cumulative CGPA across all semesters")
def calculate_cgpa_result(request: CgpaRequest):
	"""Calculate cumulative GPA with a per-semester breakdown."""
	return calculate_cgpa(request.semesters)


@router.get("/records", response_model=AcademicRecordResponse)
def get_records(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_academic_records(db, user.id)


@router.post("/semesters", response_model=AcademicSemesterRead, status_code=status.HTTP_201_CREATED)
def add_academic_semester(
	data: AcademicSemesterCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	semester = create_academic_semester(db, user.id, data)
	return AcademicSemesterRead(
		id=semester.id,
		name=semester.name,
		semester_number=semester.semester_number,
		academic_year=semester.academic_year,
		courses=[],
		sgpa=None,
		total_credits=0,
	)


@router.post("/semesters/{semester_id}/courses", response_model=AcademicCourseRead, status_code=status.HTTP_201_CREATED)
def add_academic_course(
	semester_id: int,
	data: AcademicCourseCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return create_academic_course(db, user.id, semester_id, data)


@router.patch("/courses/{course_id}", response_model=AcademicCourseRead)
def edit_academic_course(
	course_id: int,
	data: AcademicCourseUpdate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return update_academic_course(db, user.id, course_id, data)


@router.post("/target", response_model=TargetCgpaResult)
def target_cgpa(
	data: TargetCgpaRequest,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return calculate_target(db, user.id, data)


@router.post("/what-if", response_model=WhatIfResult)
def what_if(
	data: WhatIfRequest,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return calculate_what_if(db, user.id, data)
