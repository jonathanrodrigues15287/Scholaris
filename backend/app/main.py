import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.core.config import settings
from app.core.exceptions import DomainError
from app.core.logging import current_request_id
from app.core.middleware import SecurityMiddleware
from app.jobs.deadline_email_scheduler import deadline_email_lifespan
import app.models
from app.routers import assignments, attendance as attendance_router, auth, cgpa, courses, dashboard, study, timetable as timetable_router
from app.schemas.common import ErrorResponse

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def _error_response(
	status_code: int,
	detail: str,
	code: str,
	*,
	details: list[dict[str, object]] | None = None,
	headers: dict[str, str] | None = None,
) -> JSONResponse:
	request_id = current_request_id()
	return JSONResponse(
		status_code=status_code,
		content={
			"code": code,
			"message": detail,
			"details": details,
			**({"request_id": request_id} if request_id else {}),
		},
		headers=headers,
	)


app = FastAPI(
	title=settings.APP_NAME,
	version=settings.APP_VERSION,
	debug=settings.DEBUG,
	docs_url=f"{API_PREFIX}/docs",
	redoc_url=f"{API_PREFIX}/redoc",
	openapi_url=f"{API_PREFIX}/openapi.json",
	swagger_ui_oauth2_redirect_url=f"{API_PREFIX}/docs/oauth2-redirect",
	lifespan=deadline_email_lifespan,
	responses={
		400: {"model": ErrorResponse},
		401: {"model": ErrorResponse},
		403: {"model": ErrorResponse},
		404: {"model": ErrorResponse},
		409: {"model": ErrorResponse},
		422: {"model": ErrorResponse},
		500: {"model": ErrorResponse},
	},
)


def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
	code = getattr(error, "code", None) or error.__class__.__name__.removesuffix("Error").upper() or "DOMAIN_ERROR"
	return _error_response(
		error.status_code,
		error.detail,
		code,
		headers={
			**({"WWW-Authenticate": "Bearer"} if error.status_code == 401 else {}),
			**({"Retry-After": str(error.retry_after)} if hasattr(error, "retry_after") else {}),
		},
	)


def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
	details = [
		{
			"field": ".".join(str(part) for part in issue.get("loc", ())),
			"message": issue.get("msg", "Invalid value"),
			"type": issue.get("type", "validation_error"),
		}
		for issue in error.errors()
	]
	return _error_response(422, "Request validation failed", "VALIDATION_ERROR", details=details)


def handle_http_error(_: Request, error: HTTPException) -> JSONResponse:
	message = error.detail if isinstance(error.detail, str) else "Request failed"
	return _error_response(
		error.status_code,
		message,
		f"HTTP_{error.status_code}",
		headers={"WWW-Authenticate": "Bearer"} if error.status_code == 401 else {},
	)


def handle_integrity_error(_: Request, error: IntegrityError) -> JSONResponse:
	logger.warning("Database integrity constraint rejected request: %s", error.orig)
	return _error_response(409, "The request conflicts with an existing record or constraint", "INTEGRITY_CONFLICT")


def handle_stale_data_error(_: Request, error: StaleDataError) -> JSONResponse:
	message = "The assignment changed on another device; fetch the latest version and retry"
	return _error_response(409, message, "VERSION_CONFLICT")


def handle_unexpected_error(_: Request, error: Exception) -> JSONResponse:
	logger.exception("Unhandled API error", exc_info=error)
	return _error_response(500, "An unexpected server error occurred", "INTERNAL_ERROR")


app.add_exception_handler(
	DomainError,
	handle_domain_error,
)
app.add_exception_handler(RequestValidationError, handle_validation_error)
app.add_exception_handler(HTTPException, handle_http_error)
app.add_exception_handler(IntegrityError, handle_integrity_error)
app.add_exception_handler(StaleDataError, handle_stale_data_error)
app.add_exception_handler(Exception, handle_unexpected_error)
app.add_middleware(SecurityMiddleware)
app.add_middleware(
	CORSMiddleware,
	allow_origins=settings.CORS_ORIGINS,
	allow_credentials="*" not in settings.CORS_ORIGINS,
	allow_methods=["*"],
	allow_headers=["*"],
	expose_headers=["X-Request-ID"],
)
for router in (
	auth.router,
	courses.router,
	assignments.router,
	attendance_router.router,
	timetable_router.router,
	study.router,
	cgpa.router,
	dashboard.router,
):
	app.include_router(router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health", tags=["system"], response_model=dict[str, str])
def health_check():
	return {"status": "ok"}
