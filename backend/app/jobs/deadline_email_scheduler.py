from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
from datetime import timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI

from app.core.config import settings
from app.jobs.deadline_email_worker import (
	enqueue_deadline_email_job,
	start_deadline_email_worker,
	stop_deadline_email_worker,
)

logger = logging.getLogger(__name__)


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
		logger.info("Deadline email scheduler is disabled: SMTP_HOST and SMTP_FROM_ADDRESS are required")
		return None

	start_deadline_email_worker()
	scheduler = build_scheduler(settings.DEADLINE_EMAIL_HOUR_UTC, settings.DEADLINE_EMAIL_MINUTE_UTC)
	scheduler.start()
	logger.info(
		"Deadline email scheduler started; reminders run daily at %02d:%02d UTC",
		settings.DEADLINE_EMAIL_HOUR_UTC,
		settings.DEADLINE_EMAIL_MINUTE_UTC,
	)
	return scheduler


def stop_deadline_scheduler(scheduler: BackgroundScheduler | None) -> None:
	if scheduler and scheduler.running:
		scheduler.shutdown(wait=False)
	stop_deadline_email_worker()
