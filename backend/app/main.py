from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.core.config import settings
from app.core.exceptions import DomainError
from app.core.middleware import SecurityMiddleware
import app.models
from app.routers import assignments, attendance as attendance_router, auth, cgpa, courses, dashboard, study, timetable as timetable_router
from app.schemas.common import ErrorResponse

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
		404: {"model": ErrorResponse},
		409: {"model": ErrorResponse},
	},
)


def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
	code = error.__class__.__name__.removesuffix("Error").upper() or "DOMAIN_ERROR"
	return JSONResponse(
		status_code=error.status_code,
		content={
			"detail": error.detail,
			"error": {"code": code, "message": error.detail},
		},
		headers={
			**({"WWW-Authenticate": "Bearer"} if error.status_code == 401 else {}),
			**({"Retry-After": str(error.retry_after)} if hasattr(error, "retry_after") else {}),
		},
	)


app.add_exception_handler(
	DomainError,
	handle_domain_error,
)
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
