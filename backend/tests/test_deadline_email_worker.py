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
