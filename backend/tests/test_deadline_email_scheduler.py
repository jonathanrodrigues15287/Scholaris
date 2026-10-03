from datetime import timezone
from unittest.mock import patch

from app.jobs.deadline_email_scheduler import build_scheduler, start_deadline_scheduler


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
