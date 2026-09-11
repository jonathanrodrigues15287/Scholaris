from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.core.exceptions import AuthenticationError, ConflictError
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.helpers import normalise_email, normalise_name


def register_user(db: Session, data: UserCreate) -> User:
	email = normalise_email(str(data.email))
	if db.scalar(select(User).where(User.email == email)):
		raise ConflictError("A user with this email already exists")
	user = User(
		email=email,
		name=normalise_name(data.name or data.full_name),
		hashed_password=hash_password(data.password),
	)

	db.add(user)
	try:
		db.commit()
	except IntegrityError as error:
		db.rollback()
		raise ConflictError("A user with this email already exists") from error
	db.refresh(user)
	return user


def authenticate_user(db: Session, email: str, password: str) -> User:
	user = db.scalar(select(User).where(User.email == normalise_email(email)))
	if not user or not user.is_active or not verify_password(password, user.hashed_password):
		raise AuthenticationError("Incorrect email or password")
	return user

