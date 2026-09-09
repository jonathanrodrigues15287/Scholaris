from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.services.assignment_service import (
	create_assignment,
	delete_assignment,
	list_assignments,
	update_assignment,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentRead])
def get_assignments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return list_assignments(db, user.id)


@router.post("", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def add_assignment(
	data: AssignmentCreate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	try:
		return create_assignment(db, user.id, data)
	except LookupError as error:
		raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch("/{assignment_id}", response_model=AssignmentRead)
def edit_assignment(
	assignment_id: int,
	data: AssignmentUpdate,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	try:
		return update_assignment(db, user.id, assignment_id, data)
	except LookupError as error:
		raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_assignment(
	assignment_id: int,
	user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	try:
		delete_assignment(db, user.id, assignment_id)
	except LookupError as error:
		raise HTTPException(status_code=404, detail=str(error)) from error
	return Response(status_code=status.HTTP_204_NO_CONTENT)
