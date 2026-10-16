from threading import Event
from unittest.mock import patch

from app.jobs.deadline_email_worker import (
	enqueue_deadline_email_job,
	start_deadline_email_worker,
	stop_deadline_email_worker,
)


def test_worker_consumes_enqueued_deadline_email_job():
	completed = Event()

	def run_job():
		completed.set()
		return 1, 0

	with patch("app.jobs.deadline_email_worker.run_deadline_email_job", side_effect=run_job):
		start_deadline_email_worker()
		enqueue_deadline_email_job()
		assert completed.wait(timeout=2)
		stop_deadline_email_worker()


def test_worker_can_stop_and_restart_without_a_stale_sentinel():
	completed = Event()

	def run_job():
		completed.set()
		return 1, 0

	with patch("app.jobs.deadline_email_worker.run_deadline_email_job", side_effect=run_job):
		start_deadline_email_worker()
		stop_deadline_email_worker()
		worker = start_deadline_email_worker()
		enqueue_deadline_email_job()
		assert completed.wait(timeout=2)
		assert worker.is_alive()
		stop_deadline_email_worker()


def test_worker_retries_transient_failures_and_exhausts_attempts():
	attempts = 0

	def run_job():
		nonlocal attempts
		attempts += 1
		raise TimeoutError("SMTP unavailable")

	with patch("app.jobs.deadline_email_worker.run_deadline_email_job", side_effect=run_job), patch(
		"app.jobs.deadline_email_worker._INITIAL_RETRY_DELAY_SECONDS", 0
	), patch("app.jobs.deadline_email_worker.random.random", return_value=0):
		start_deadline_email_worker()
		enqueue_deadline_email_job()
		for _ in range(20):
			if attempts == 3:
				break
			Event().wait(0.01)
		stop_deadline_email_worker()

	assert attempts == 3
