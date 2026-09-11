from typing import Literal

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import PaginationParams, get_current_user
from app.schemas.common import Page, make_page
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.services.course_service import create_course, delete_course, get_course, list_courses, update_course

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=Page[CourseRead])
def get_courses(
	sort_order: Literal["asc", "desc"] = "asc",
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = list_courses(db, user.id, pagination.page, pagination.page_size, sort_order)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/{course_id}", response_model=CourseRead)
def get_course_item(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_course(db, user.id, course_id)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def add_course(
	data: CourseCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	return create_course(db, user.id, data)


@router.patch("/{course_id}", response_model=CourseRead)
def edit_course(course_id: int, data: CourseUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return update_course(db, user.id, course_id, data)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	delete_course(db, user.id, course_id)
