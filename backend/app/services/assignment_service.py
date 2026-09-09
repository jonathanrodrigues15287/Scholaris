from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.course import Course
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate


def list_assignments(db: Session, owner_id: int) -> list[Assignment]:
	return list(
		db.scalars(
			select(Assignment)
			.join(Course)
			.where(Course.user_id == owner_id)
			.order_by(Assignment.due_date, Assignment.created_at)
		)
	)


def create_assignment(db: Session, owner_id: int, data: AssignmentCreate) -> Assignment:
	course = db.scalar(select(Course).where(Course.id == data.course_id, Course.user_id == owner_id))
	if not course:
		raise LookupError("Course not found")
	assignment = Assignment(**data.model_dump(), user_id=owner_id)
	db.add(assignment)
	db.commit()
	db.refresh(assignment)
	return assignment


def update_assignment(db: Session, owner_id: int, assignment_id: int, data: AssignmentUpdate) -> Assignment:
	assignment = db.scalar(
		select(Assignment)
		.join(Course)
		.where(Assignment.id == assignment_id, Course.user_id == owner_id)
	)
	if not assignment:
		raise LookupError("Assignment not found")
	for key, value in data.model_dump(exclude_unset=True).items():
		setattr(assignment, key, value)
	db.commit()
	db.refresh(assignment)
	return assignment


def delete_assignment(db: Session, owner_id: int, assignment_id: int) -> None:
	assignment = db.scalar(
		select(Assignment)
		.join(Course)
		.where(Assignment.id == assignment_id, Course.user_id == owner_id)
	)
	if not assignment:
		raise LookupError("Assignment not found")
	db.delete(assignment)
	db.commit()
