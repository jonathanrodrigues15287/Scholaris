from __future__ import annotations

from dataclasses import dataclass
import logging
import random
from queue import Empty, Queue
from threading import Event, Lock, Thread

from app.jobs.deadline_email_reminders import run_deadline_email_job

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeadlineEmailTask:
	name: str = "deadline_email_reminders"


_tasks: Queue[DeadlineEmailTask | None] = Queue()
_stop_requested = Event()
_worker_lock = Lock()
_worker: Thread | None = None
_STOP_TIMEOUT_SECONDS = 10
_MAX_ATTEMPTS = 3
_INITIAL_RETRY_DELAY_SECONDS = 5
_MAX_RETRY_DELAY_SECONDS = 60


def enqueue_deadline_email_job() -> None:
	_tasks.put(DeadlineEmailTask())
	logger.info("Deadline email job enqueued")


def _run_worker() -> None:
	while True:
		try:
			task = _tasks.get(timeout=0.5)
		except Empty:
			if _stop_requested.is_set():
				break
			continue
		if task is None:
			_tasks.task_done()
			continue
		if _stop_requested.is_set():
			_tasks.task_done()
			_tasks.put(task)
			break
		try:
			if task.name == "deadline_email_reminders":
				_run_with_retries(task)
			else:
				logger.error("Unknown background task: %s", task.name)
		except Exception:
			logger.exception("Background task failed: %s", task.name)
		finally:
			_tasks.task_done()


def _run_with_retries(task: DeadlineEmailTask) -> None:
	for attempt in range(1, _MAX_ATTEMPTS + 1):
		try:
			run_deadline_email_job()
			return
		except (TimeoutError, OSError) as error:
			if attempt == _MAX_ATTEMPTS:
				logger.error("Deadline email task exhausted retries: %s", task.name, exc_info=error)
				return
			delay = min(
				_INITIAL_RETRY_DELAY_SECONDS * 2 ** (attempt - 1),
				_MAX_RETRY_DELAY_SECONDS,
			)
			delay *= 0.8 + random.random() * 0.4
			logger.warning(
				"Transient deadline email failure; retrying attempt %d/%d in %.1fs",
				attempt + 1,
				_MAX_ATTEMPTS,
				delay,
			)
			if _stop_requested.wait(delay):
				_tasks.put(task)
				return
		except Exception:
			logger.exception("Permanent deadline email task failure: %s", task.name)
			return


def start_deadline_email_worker() -> Thread:
	global _worker
	with _worker_lock:
		if _worker and _worker.is_alive():
			return _worker
		_stop_requested.clear()
		_worker = Thread(target=_run_worker, name="deadline-email-worker", daemon=True)
		_worker.start()
		logger.info("Deadline email worker started")
		return _worker


def stop_deadline_email_worker() -> None:
	global _worker
	with _worker_lock:
		worker = _worker
		if not worker:
			return
		_stop_requested.set()
	worker.join(timeout=_STOP_TIMEOUT_SECONDS)
	with _worker_lock:
		if worker.is_alive():
			logger.error("Deadline email worker did not stop within %ss", _STOP_TIMEOUT_SECONDS)
			return
		_worker = None
	logger.info("Deadline email worker stopped")
