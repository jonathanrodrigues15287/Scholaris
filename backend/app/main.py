import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.exceptions import DomainError
from app.core.middleware import SecurityMiddleware
import app.models
from app.routers import assignments, attendance as attendance_router, auth, cgpa, courses, dashboard, study, timetable as timetable_router
from app.schemas.common import ErrorResponse

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"

app = FastAPI(
	title=settings.APP_NAME,
	version=settings.APP_VERSION,
	debug=settings.DEBUG,
	docs_url=f"{API_PREFIX}/docs",
	redoc_url=f"{API_PREFIX}/redoc",
	openapi_url=f"{API_PREFIX}/openapi.json",
	swagger_ui_oauth2_redirect_url=f"{API_PREFIX}/docs/oauth2-redirect",
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
	code = error.__class__.__name__.removesuffix("Error").upper() or "DOMAIN_ERROR"
	return JSONResponse(
		status_code=error.status_code,
		content={
			"detail": error.detail,
			"error": {"code": code, "message": error.detail, "details": []},
		},
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
	return JSONResponse(
		status_code=422,
		content={
			"detail": "Request validation failed",
			"error": {"code": "VALIDATION_ERROR", "message": "Request validation failed", "details": details},
		},
	)


def handle_http_error(_: Request, error: HTTPException) -> JSONResponse:
	message = error.detail if isinstance(error.detail, str) else "Request failed"
	return JSONResponse(
		status_code=error.status_code,
		content={
			"detail": message,
			"error": {"code": f"HTTP_{error.status_code}", "message": message, "details": []},
		},
		headers={"WWW-Authenticate": "Bearer"} if error.status_code == 401 else {},
	)


def handle_integrity_error(_: Request, error: IntegrityError) -> JSONResponse:
	logger.warning("Database integrity constraint rejected request: %s", error.orig)
	return JSONResponse(
		status_code=409,
		content={
			"detail": "The request conflicts with an existing record or constraint",
			"error": {
				"code": "INTEGRITY_CONFLICT",
				"message": "The request conflicts with an existing record or constraint",
				"details": [],
			},
		},
	)


def handle_unexpected_error(_: Request, error: Exception) -> JSONResponse:
	logger.exception("Unhandled API error", exc_info=error)
	return JSONResponse(
		status_code=500,
		content={
			"detail": "An unexpected server error occurred",
			"error": {"code": "INTERNAL_ERROR", "message": "An unexpected server error occurred", "details": []},
		},
	)


app.add_exception_handler(
	DomainError,
	handle_domain_error,
)
app.add_exception_handler(RequestValidationError, handle_validation_error)
app.add_exception_handler(HTTPException, handle_http_error)
app.add_exception_handler(IntegrityError, handle_integrity_error)
app.add_exception_handler(Exception, handle_unexpected_error)
app.add_middleware(SecurityMiddleware)
app.add_middleware(
	CORSMiddleware,
	allow_origins=settings.CORS_ORIGINS,
	allow_credentials="*" not in settings.CORS_ORIGINS,
	allow_methods=["*"],
	allow_headers=["*"],
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
