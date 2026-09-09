from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.course import Course
from app.schemas.course import CourseCreate


def list_courses(db: Session, owner_id: int) -> list[Course]:
    return list(db.scalars(select(Course).where(Course.user_id == owner_id).order_by(Course.name)))


def create_course(db: Session, owner_id: int, data: CourseCreate) -> Course:
    course = Course(
        user_id=owner_id,
        name=data.name.strip(),
        code=data.code.strip().upper(),
        credits=data.credits,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course
