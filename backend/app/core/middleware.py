import hmac
import secrets
from uuid import UUID, uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import reset_request_id, set_request_id


class SecurityMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next) -> Response:
		request_id = request.headers.get("X-Request-ID")
		if request_id:
			try:
				request_id = str(UUID(request_id))
			except ValueError:
				request_id = None
		request_id = request_id or str(uuid4())
		request_id_token = set_request_id(request_id)
		try:
			if request.method not in {"GET", "HEAD", "OPTIONS"}:
				if request.cookies.get("access_token") or request.cookies.get("refresh_token"):
					csrf_cookie = request.cookies.get("csrf_token", "")
					csrf_header = request.headers.get("X-CSRF-Token", "")
					if not csrf_cookie or not hmac.compare_digest(csrf_cookie, csrf_header):
						response = JSONResponse(
							status_code=403,
							content={
								"code": "CSRF_ERROR",
								"message": "CSRF validation failed",
								"details": None,
								"request_id": request_id,
							},
						)
					else:
						response = await call_next(request)
				else:
					response = await call_next(request)
			else:
				response = await call_next(request)

			if "csrf_token" not in request.cookies:
				response.set_cookie(
					"csrf_token",
					secrets.token_urlsafe(32),
					httponly=False,
					secure=settings.secure_cookies,
					samesite="lax",
					path="/",
					domain=settings.COOKIE_DOMAIN,
				)
			response.headers["X-Request-ID"] = request_id
			response.headers.setdefault("X-Content-Type-Options", "nosniff")
			response.headers.setdefault("X-Frame-Options", "DENY")
			response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
			response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			if settings.secure_cookies:
				response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			return response
		finally:
			reset_request_id(request_id_token)