from fastapi import Depends, Query
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import AuthenticationError
from app.models.user import User

cookie_scheme = APIKeyCookie(name="access_token", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
    ):
        self.page = page
        self.page_size = page_size


def get_current_user(
    cookie_token: str | None = Depends(cookie_scheme),
    bearer: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = cookie_token or (bearer.credentials if bearer else None)
    if not token:
        raise AuthenticationError("Authentication required")
    try:
        user_id = int(decode_access_token(token))
    except (jwt.InvalidTokenError, TypeError, ValueError) as error:
        raise AuthenticationError("Invalid or expired token") from error
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise AuthenticationError("User not found")
    return user
