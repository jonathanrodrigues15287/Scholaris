import logging
import smtplib
import ssl
from datetime import date, timedelta
from email.message import EmailMessage

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.user import User

logger = logging.getLogger(__name__)


def _send_email(recipient: str, subject: str, body: str) -> None:
	if not settings.SMTP_HOST or not settings.SMTP_FROM_ADDRESS:
		raise RuntimeError("Configure SMTP_HOST and SMTP_FROM_ADDRESS to send deadline emails")
	smtp_username = (settings.SMTP_USERNAME or "").strip()
	smtp_password = settings.SMTP_PASSWORD.get_secret_value() if settings.SMTP_PASSWORD else ""
	if bool(smtp_username) != bool(smtp_password):
		raise RuntimeError("Configure both SMTP_USERNAME and SMTP_PASSWORD, or neither")

	message = EmailMessage()
	message["From"] = settings.SMTP_FROM_ADDRESS
	message["To"] = recipient
	message["Subject"] = subject
	message.set_content(body)

	if settings.SMTP_USE_SSL:
		server_context = smtplib.SMTP_SSL(
			settings.SMTP_HOST,
			settings.SMTP_PORT,
			context=ssl.create_default_context(),
			timeout=20,
		)
	else:
		server_context = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)

	with server_context as server:
		if not settings.SMTP_USE_SSL:
			server.starttls(context=ssl.create_default_context())
		if smtp_username and smtp_password:
			server.login(smtp_username, smtp_password)
		server.send_message(message)


def send_deadline_emails(db: Session, today: date | None = None) -> tuple[int, int]:
	"""Send one daily email per user for incomplete assignments due tomorrow."""
	due_date = (today or date.today()) + timedelta(days=1)
	assignments = list(
		db.scalars(
			select(Assignment)
			.join(User, Assignment.user_id == User.id)
			.join(Course, Assignment.course_id == Course.id)
			.where(
				Assignment.due_date == due_date,
				or_(
					Assignment.deadline_email_sent_for.is_(None),
					Assignment.deadline_email_sent_for != due_date,
				),
				Assignment.deleted_at.is_(None),
				Assignment.status.not_in(("completed", "submitted")),
				Course.deleted_at.is_(None),
				User.is_active.is_(True),
			)
			.order_by(Assignment.user_id, Assignment.due_date, Assignment.title)
		)
	)

	assignments_by_user = {}
	for assignment in assignments:
		assignments_by_user.setdefault(assignment.user_id, []).append(assignment)

	sent = 0
	failed = 0
	for user_assignments in assignments_by_user.values():
		user = user_assignments[0].user
		lines = [f"Hello {user.name},", "", "These assignments are due tomorrow:", ""]
		lines.extend(
			f"- {assignment.title} ({assignment.course.name})"
			for assignment in user_assignments
		)
		lines.extend(("", "Log in to Scholaris to review your assignments."))
		try:
			_send_email(
				user.email,
				f"Scholaris: {len(user_assignments)} assignment(s) due tomorrow",
				"\n".join(lines),
			)
		except Exception:
			failed += 1
			logger.exception("Could not send deadline email to user id %s", user.id)
			continue

		for assignment in user_assignments:
			assignment.deadline_email_sent_for = due_date
		db.commit()
		sent += 1

	return sent, failed
