from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, data: UserCreate) -> User:
	email = str(data.email).lower()
	if db.scalar(select(User).where(User.email == email)):
		raise ValueError("A user with this email already exists")
	user = User(
		email=email,
		name=(data.name or data.full_name).strip(),
		hashed_password=hash_password(data.password),
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
	user = db.scalar(select(User).where(User.email == email.lower()))
	if not user or not user.is_active or not verify_password(password, user.hashed_password):
		return None
	return user
