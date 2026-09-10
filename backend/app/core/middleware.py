import hmac
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings


class SecurityMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next) -> Response:
		if request.method not in {"GET", "HEAD", "OPTIONS"}:
			if request.cookies.get("access_token") or request.cookies.get("refresh_token"):
				csrf_cookie = request.cookies.get("csrf_token", "")
				csrf_header = request.headers.get("X-CSRF-Token", "")
				if not csrf_cookie or not hmac.compare_digest(csrf_cookie, csrf_header):
					return JSONResponse(
						status_code=403,
						content={
							"detail": "CSRF validation failed",
							"error": {"code": "CSRF_ERROR", "message": "CSRF validation failed"},
						},
					)

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
		response.headers.setdefault("X-Content-Type-Options", "nosniff")
		response.headers.setdefault("X-Frame-Options", "DENY")
		response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
		response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if settings.secure_cookies:
			response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		return response
