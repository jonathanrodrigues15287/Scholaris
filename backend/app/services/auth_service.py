from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.core.exceptions import AuthenticationError, ConflictError
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.helpers import normalise_email, normalise_name


def normalise_username(value: str) -> str:
	return value.strip().lower()


def register_user(db: Session, data: UserCreate) -> User:
	username = normalise_username(data.username or str(data.email).split("@", 1)[0])
	email = normalise_email(str(data.email)) if data.email else f"{username}@users.scholaris.app"
	if db.scalar(select(User).where((User.username == username) | (User.email == email))):
		raise ConflictError("A user with this username or email already exists")
	user = User(
		username=username,
		email=email,
		name=normalise_name(data.name or data.full_name or username),
		hashed_password=hash_password(data.password),
	)

	db.add(user)
	try:
		db.commit()
	except IntegrityError as error:
		db.rollback()
		raise ConflictError("A user with this username or email already exists") from error
	db.refresh(user)
	return user


def authenticate_user(db: Session, identifier: str, password: str) -> User:
	identifier = identifier.strip().lower()
	user = db.scalar(
		select(User).where((User.username == identifier) | (User.email == normalise_email(identifier)))
	)
	if not user or not user.is_active or not verify_password(password, user.hashed_password):
		raise AuthenticationError("Incorrect email or password")
	return user

