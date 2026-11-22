from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI

from app.core.config import settings
from app.jobs.deadline_email_worker import (
	enqueue_deadline_email_job,
	get_deadline_email_worker_status,
	start_deadline_email_worker,
	stop_deadline_email_worker,
)

logger = logging.getLogger(__name__)
_scheduler_status = {
	"state": "disabled",
	"started_at": None,
	"stopped_at": None,
	"last_error": None,
	"schedule_utc": None,
}


def get_deadline_scheduler_status() -> dict[str, object]:
	status = dict(_scheduler_status)
	status["worker"] = get_deadline_email_worker_status()
	return status


@asynccontextmanager
async def deadline_email_lifespan(_: FastAPI) -> AsyncIterator[None]:
	scheduler = start_deadline_scheduler()
	try:
		yield
	finally:
		stop_deadline_scheduler(scheduler)


def build_scheduler(hour: int, minute: int) -> BackgroundScheduler:
	scheduler = BackgroundScheduler(timezone=timezone.utc)
	scheduler.add_job(
		enqueue_deadline_email_job,
		CronTrigger(hour=hour, minute=minute, timezone=timezone.utc),
		id="deadline_email_reminders",
		name="Assignment deadline email reminders",
		replace_existing=True,
		coalesce=True,
		max_instances=1,
		misfire_grace_time=6 * 60 * 60,
	)
	return scheduler


def start_deadline_scheduler() -> BackgroundScheduler | None:
	if not settings.SMTP_HOST or not settings.SMTP_FROM_ADDRESS:
		_scheduler_status.update({
			"state": "disabled",
			"last_error": "SMTP_HOST and SMTP_FROM_ADDRESS are required",
			"schedule_utc": None,
		})
		logger.info("Deadline email scheduler is disabled: SMTP_HOST and SMTP_FROM_ADDRESS are required")
		return None

	try:
		start_deadline_email_worker()
	except Exception:
		_scheduler_status.update({
			"state": "degraded",
			"last_error": "Deadline email worker failed to start",
		})
		logger.exception("Partial startup: deadline email worker failed")
		return None
	scheduler = build_scheduler(settings.DEADLINE_EMAIL_HOUR_UTC, settings.DEADLINE_EMAIL_MINUTE_UTC)
	try:
		scheduler.start()
	except Exception:
		stop_deadline_email_worker()
		_scheduler_status.update({
			"state": "failed",
			"last_error": "Deadline email scheduler failed to start",
		})
		logger.exception("Deadline email scheduler failed to start")
		return None
	_scheduler_status.update({
		"state": "running",
		"started_at": datetime.now(timezone.utc).isoformat(),
		"stopped_at": None,
		"last_error": None,
		"schedule_utc": f"{settings.DEADLINE_EMAIL_HOUR_UTC:02d}:{settings.DEADLINE_EMAIL_MINUTE_UTC:02d}",
	})
	logger.info(
		"Deadline email scheduler started; reminders run daily at %02d:%02d UTC",
		settings.DEADLINE_EMAIL_HOUR_UTC,
		settings.DEADLINE_EMAIL_MINUTE_UTC,
	)
	return scheduler


def stop_deadline_scheduler(scheduler: BackgroundScheduler | None) -> None:
	if scheduler and scheduler.running:
		try:
			scheduler.shutdown(wait=False)
			logger.info("Deadline email scheduler stopped")
		except Exception:
			_scheduler_status.update({
				"state": "failed",
				"last_error": "Deadline email scheduler failed to stop cleanly",
			})
			logger.exception("Deadline email scheduler shutdown failed")
	stop_deadline_email_worker()
	if _scheduler_status["state"] in {"running", "failed", "degraded"}:
		_scheduler_status["state"] = "stopped"
	_scheduler_status.update({
		"stopped_at": datetime.now(timezone.utc).isoformat(),
	})