import asyncio
from datetime import timezone
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
import pytest

from app.jobs.deadline_email_scheduler import (
	build_scheduler,
	deadline_email_lifespan,
	start_deadline_scheduler,
)


def test_scheduler_runs_daily_at_configured_utc_time():
	scheduler = build_scheduler(hour=8, minute=30)
	job = scheduler.get_job("deadline_email_reminders")

	assert job is not None
	assert job.trigger.timezone == timezone.utc
	assert job.trigger.fields[5].expressions[0].__str__() == "8"
	assert job.trigger.fields[6].expressions[0].__str__() == "30"
	assert job.coalesce is True
	assert job.max_instances == 1


def test_scheduler_is_not_started_without_smtp_configuration():
	with (
		patch("app.jobs.deadline_email_scheduler.settings.SMTP_HOST", None),
		patch("app.jobs.deadline_email_scheduler.settings.SMTP_FROM_ADDRESS", None),
	):
		assert start_deadline_scheduler() is None


def test_application_lifespan_starts_and_stops_scheduler():
	scheduler = object()

	async def run_lifespan():
		async with deadline_email_lifespan(FastAPI()):
			pass

	with (
		patch("app.jobs.deadline_email_scheduler.start_deadline_scheduler", return_value=scheduler) as start,
		patch("app.jobs.deadline_email_scheduler.stop_deadline_scheduler") as stop,
	):
		asyncio.run(run_lifespan())

	start.assert_called_once_with()
	stop.assert_called_once_with(scheduler)


def test_application_lifespan_stops_scheduler_when_startup_body_fails():
	scheduler = object()

	async def run_lifespan():
		async with deadline_email_lifespan(FastAPI()):
			raise RuntimeError("startup consumer failure")

	with (
		patch("app.jobs.deadline_email_scheduler.start_deadline_scheduler", return_value=scheduler),
		patch("app.jobs.deadline_email_scheduler.stop_deadline_scheduler") as stop,
	):
		try:
			asyncio.run(run_lifespan())
		except RuntimeError as error:
			assert str(error) == "startup consumer failure"
		else:
			raise AssertionError("lifespan exception should propagate")

	stop.assert_called_once_with(scheduler)


def test_scheduler_startup_failure_stops_worker():
	scheduler = MagicMock()
	scheduler.start.side_effect = RuntimeError("scheduler unavailable")

	with (
		patch("app.jobs.deadline_email_scheduler.settings.SMTP_HOST", "smtp.example.com"),
		patch("app.jobs.deadline_email_scheduler.settings.SMTP_FROM_ADDRESS", "alerts@example.com"),
		patch("app.jobs.deadline_email_scheduler.start_deadline_email_worker") as start_worker,
		patch("app.jobs.deadline_email_scheduler.stop_deadline_email_worker") as stop_worker,
		patch("app.jobs.deadline_email_scheduler.build_scheduler", return_value=scheduler),
	):
		with pytest.raises(RuntimeError, match="scheduler unavailable"):
			start_deadline_scheduler()

	start_worker.assert_called_once_with()
	stop_worker.assert_called_once_with()