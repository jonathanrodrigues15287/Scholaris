from sqlalchemy import select
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.course import Course
from app.utils.validators import require_semester
from app.schemas.course import CourseCreate, CourseUpdate
from app.utils.helpers import normalise_code, normalise_name
from app.utils.pagination import fetch_page
from app.utils.validators import require_course


def list_courses(
    db: Session,
    owner_id: int,
    page: int = 1,
    page_size: int = 20,
    sort_order: str = "asc",
) -> tuple[list[Course], int]:
    query = select(Course).where(Course.user_id == owner_id, Course.deleted_at.is_(None))
    order = Course.name.asc() if sort_order == "asc" else Course.name.desc()
    return fetch_page(query.order_by(order), db, page, page_size)


def create_course(db: Session, owner_id: int, data: CourseCreate) -> Course:
    if data.semester_id is not None:
        require_semester(db, owner_id, data.semester_id)
    course = Course(
        user_id=owner_id,
        name=normalise_name(data.name),
        code=normalise_code(data.code),
        credits=data.credits,
        grade=data.grade,
        semester_id=data.semester_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def get_course(db: Session, owner_id: int, course_id: int) -> Course:
    return require_course(db, owner_id, course_id)


def update_course(db: Session, owner_id: int, course_id: int, data: CourseUpdate) -> Course:
    course = require_course(db, owner_id, course_id)
    values = data.model_dump(exclude_unset=True)
    if values.get("semester_id") is not None:
        require_semester(db, owner_id, values["semester_id"])
    if "name" in values:
        values["name"] = normalise_name(values["name"])
    if "code" in values:
        values["code"] = normalise_code(values["code"])
    for key, value in values.items():
        setattr(course, key, value)
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, owner_id: int, course_id: int) -> None:
    course = require_course(db, owner_id, course_id)
    course.deleted_at = datetime.now(timezone.utc)
    db.commit()

