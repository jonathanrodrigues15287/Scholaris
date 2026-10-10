import logging

from app.core.database import SessionLocal
from app.services.deadline_email_service import send_deadline_emails


def run_deadline_email_job() -> tuple[int, int]:
	with SessionLocal() as db:
		return send_deadline_emails(db)


def main() -> int:
	logging.basicConfig(level=logging.INFO)
	sent, failed = run_deadline_email_job()
	logging.info("Deadline email job complete: %s sent, %s failed", sent, failed)
	return 1 if failed else 0


if __name__ == "__main__":
	raise SystemExit(main())
