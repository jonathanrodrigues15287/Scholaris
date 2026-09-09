from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.course import CourseCreate, CourseRead
from app.services.course_service import create_course, list_courses

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseRead])
def get_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return list_courses(db, user.id)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def add_course(
	data: CourseCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return create_course(db, user.id, data)
