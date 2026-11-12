from datetime import date, timedelta

from app.core.security import hash_password
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.user import User
from app.services import deadline_email_service


def test_deadline_email_job_sends_grouped_reminders_and_marks_assignments(
    db_session, monkeypatch
):
    user = User(
        username="deadline-user",
        email="deadline@example.com",
        name="Deadline User",
        hashed_password=hash_password("StrongPassword1!"),
    )
    db_session.add(user)
    db_session.flush()
    course = Course(user_id=user.id, name="Algorithms", code="CS101", credits=3)
    db_session.add(course)
    db_session.flush()
    due_date = date(2030, 1, 2)
    assignment = Assignment(
        user_id=user.id,
        course_id=course.id,
        title="Read graphs",
        due_date=due_date,
        status="pending",
        priority="medium",
        priority_mode="manual",
    )
    db_session.add(assignment)
    db_session.commit()

    sent = []
    monkeypatch.setattr(
        deadline_email_service,
        "_send_email",
        lambda recipient, subject, body: sent.append((recipient, subject, body)),
    )

    result = deadline_email_service.send_deadline_emails(
        db_session, today=due_date - timedelta(days=1)
    )
    db_session.refresh(assignment)

    assert result == (1, 0)
    assert sent[0][0] == "deadline@example.com"
    assert "Read graphs" in sent[0][2]
    assert assignment.deadline_email_sent_for == due_date
