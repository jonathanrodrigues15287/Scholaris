from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import PaginationParams, get_current_user
from app.schemas.common import Page, make_page
from app.schemas.study_session import (
	StudyGoalRead,
	StudyGoalUpdate,
	StudySessionCreate,
	StudySessionRead,
	StudySessionUpdate,
	StudyStats,
	StudySuggestion,
)
from app.services.study_service import (
	create_session,
	delete_session,
	get_session,
	get_study_goal,
	list_sessions,
	study_suggestions,
	study_stats,
	update_session,
	update_study_goal,
)

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/stats", response_model=StudyStats)
def get_study_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return study_stats(db, user.id)


@router.get("/suggestions", response_model=list[StudySuggestion])
def get_study_suggestions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return study_suggestions(db, user.id)


@router.get("/goal", response_model=StudyGoalRead)
def get_goal(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_study_goal(db, user.id)


@router.patch("/goal", response_model=StudyGoalRead)
def set_goal(data: StudyGoalUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return update_study_goal(db, user.id, data)


@router.get("/sessions", response_model=Page[StudySessionRead])
def get_study_sessions(
	course_id: int | None = Query(default=None, ge=1),
	assignment_id: int | None = Query(default=None, ge=1),
	sort_order: Literal["asc", "desc"] = "desc",
	pagination: PaginationParams = Depends(),
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	items, total = list_sessions(db, user.id, course_id, assignment_id, pagination.page, pagination.page_size, sort_order)
	return make_page(items, total, pagination.page, pagination.page_size)


@router.get("/sessions/{session_id}", response_model=StudySessionRead)
def get_study_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_session(db, user.id, session_id)


@router.post("/sessions", response_model=StudySessionRead, status_code=status.HTTP_201_CREATED)
def start_study_session(data: StudySessionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return create_session(db, user.id, data)


@router.patch("/sessions/{session_id}", response_model=StudySessionRead)
def edit_study_session(session_id: int, data: StudySessionUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return update_session(db, user.id, session_id, data)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_study_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	delete_session(db, user.id, session_id)
