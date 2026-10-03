from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import SecretStr

from app.services.deadline_email_service import _send_email, send_deadline_emails


def _assignment(assignment_id, user_id, title, due_date):
	user = SimpleNamespace(id=user_id, name=f"User {user_id}", email=f"user{user_id}@example.com")
	course = SimpleNamespace(name="Biology")
	return SimpleNamespace(
		id=assignment_id,
		user_id=user_id,
		title=title,
		due_date=due_date,
		user=user,
		course=course,
		deadline_email_sent_for=None,
	)


def test_sends_one_email_per_user_and_marks_due_date():
	due_date = date(2026, 10, 2)
	assignments = [
		_assignment(1, 7, "Lab report", due_date),
		_assignment(2, 7, "Reading notes", due_date),
		_assignment(3, 8, "Problem set", due_date),
	]
	db = SimpleNamespace(scalars=lambda query: assignments, commit=lambda: None)

	with patch("app.services.deadline_email_service._send_email") as send_email:
		assert send_deadline_emails(db, today=date(2026, 10, 1)) == (2, 0)

	assert send_email.call_count == 2
	assert "Lab report (Biology)" in send_email.call_args_list[0].args[2]
	assert "Reading notes (Biology)" in send_email.call_args_list[0].args[2]
	assert all(item.deadline_email_sent_for == due_date for item in assignments)


def test_failed_email_does_not_mark_assignment_as_sent():
	due_date = date(2026, 10, 2)
	assignment = _assignment(1, 7, "Lab report", due_date)
	db = SimpleNamespace(scalars=lambda query: [assignment], commit=lambda: None)

	with patch("app.services.deadline_email_service._send_email", side_effect=OSError("SMTP unavailable")):
		assert send_deadline_emails(db, today=date(2026, 10, 1)) == (0, 1)

	assert assignment.deadline_email_sent_for is None


def test_sends_email_with_starttls_without_blank_credentials():
	with (
		patch("app.services.deadline_email_service.settings.SMTP_HOST", "smtp.example.com"),
		patch("app.services.deadline_email_service.settings.SMTP_PORT", 587),
		patch("app.services.deadline_email_service.settings.SMTP_USERNAME", ""),
		patch("app.services.deadline_email_service.settings.SMTP_PASSWORD", SecretStr("")),
		patch("app.services.deadline_email_service.settings.SMTP_FROM_ADDRESS", "alerts@example.com"),
		patch("app.services.deadline_email_service.settings.SMTP_USE_SSL", False),
		patch("app.services.deadline_email_service.smtplib.SMTP") as smtp_factory,
	):
		_send_email("student@example.com", "Due tomorrow", "Finish the assignment.")

	server = smtp_factory.return_value.__enter__.return_value
	server.starttls.assert_called_once()
	server.login.assert_not_called()
	server.send_message.assert_called_once()
