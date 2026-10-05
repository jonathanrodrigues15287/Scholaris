from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AuthenticationError
from app.core.rate_limit import check_login_allowed, clear_login_failures, record_login_failure
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.user import AuthSession, UserCreate, UserRead
from app.services.auth_service import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"


def _set_session_cookies(response: Response, db: Session, user_id: int) -> RefreshToken:
	refresh_token = create_refresh_token(str(user_id))
	refresh_token_record = RefreshToken(
		user_id=user_id,
		token_hash=hash_refresh_token(refresh_token),
		expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
	)
	db.add(refresh_token_record)

	common = {
		"httponly": True,
		"secure": settings.secure_cookies,
		"samesite": "lax",
		"domain": settings.COOKIE_DOMAIN,
		"path": "/",
	}
	response.set_cookie(
		_ACCESS_COOKIE,
		create_access_token(str(user_id)),
		max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
		**common,
	)
	response.set_cookie(
		_REFRESH_COOKIE,
		refresh_token,
		max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
		**common,
	)
	return refresh_token_record


def _clear_session_cookies(response: Response) -> None:
	response.delete_cookie(_ACCESS_COOKIE, path="/", domain=settings.COOKIE_DOMAIN)
	response.delete_cookie(_REFRESH_COOKIE, path="/", domain=settings.COOKIE_DOMAIN)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
	return register_user(db, data)


@router.post("/login", response_model=AuthSession)
def login(
	request: Request,
	response: Response,
	form: OAuth2PasswordRequestForm = Depends(),
	db: Session = Depends(get_db),
):
	ip_identifier = request.client.host if request.client else "unknown"
	account_identifier = f"{ip_identifier}:{form.username.strip().lower()}"
	check_login_allowed(ip_identifier)
	check_login_allowed(account_identifier)
	try:
		user = authenticate_user(db, form.username, form.password)
	except AuthenticationError:
		record_login_failure(ip_identifier)
		record_login_failure(account_identifier)
		raise
	clear_login_failures(account_identifier)
	_set_session_cookies(response, db, user.id)
	db.commit()
	return AuthSession(user=user)


@router.post("/refresh", response_model=AuthSession)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
	refresh_token = request.cookies.get(_REFRESH_COOKIE)
	if not refresh_token:
		raise AuthenticationError("Authentication required")
	try:
		user_id = int(decode_token(refresh_token, "refresh"))
	except (jwt.InvalidTokenError, ValueError, TypeError):
		raise AuthenticationError("Invalid or expired refresh token")
	token_record = db.scalar(
		select(RefreshToken)
		.where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
		.with_for_update()
	)
	user = db.get(User, user_id)
	now = datetime.now(timezone.utc)
	expires_at = None
	if token_record:
		expires_at = token_record.expires_at
		if expires_at.tzinfo is None:
			expires_at = expires_at.replace(tzinfo=timezone.utc)
	if (
		not token_record
		or token_record.user_id != user_id
		or token_record.revoked_at is not None
		or expires_at is None
		or expires_at <= now
		or not user
		or not user.is_active
	):
		raise AuthenticationError("Invalid or expired refresh token")
	token_record.revoked_at = now
	replacement = _set_session_cookies(response, db, user.id)
	db.flush()
	token_record.replaced_by = replacement.id
	db.commit()
	return AuthSession(user=user)


@router.get("/me", response_model=UserRead)
def current_user(user: User = Depends(get_current_user)):
	return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
	refresh_token = request.cookies.get(_REFRESH_COOKIE)
	if refresh_token:
		token_record = db.scalar(
			select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
		)
		if token_record and token_record.revoked_at is None:
			token_record.revoked_at = datetime.now(timezone.utc)
			db.commit()
	_clear_session_cookies(response)
