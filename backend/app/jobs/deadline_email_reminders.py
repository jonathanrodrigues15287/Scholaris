import logging

from app.core.database import SessionLocal
from app.services.deadline_email_service import send_deadline_emails


def run_deadline_email_job() -> tuple[int, int]:
	with SessionLocal() as db:
		sent, failed = send_deadline_emails(db)
	logging.info("Deadline email job complete: %s sent, %s failed", sent, failed)
	return sent, failed


def main() -> int:
	logging.basicConfig(level=logging.INFO)
	_, failed = run_deadline_email_job()
	return 1 if failed else 0


if __name__ == "__main__":
	raise SystemExit(main())
