"""
validators.py - Reusable guard / existence-check functions.

These wrap common "does this row exist and does it belong to this user?"
patterns that would otherwise be duplicated across every service module.

Usage:
    from app.utils.validators import require_course, require_assignment, ...
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.assignment import Assignment
from app.models.attendance import Attendance
from app.models.course import Course
from app.models.study_session import StudySession
from app.models.timetable import Timetable
from app.models.semester import Semester


# ---------------------------------------------------------------------------
# Course
# ---------------------------------------------------------------------------

def require_course(db: Session, owner_id: int, course_id: int) -> Course:
    """
    Return the Course owned by *owner_id* or raise NotFoundError.

    Use this instead of writing an inline select in every service that needs
    to verify a course belongs to the authenticated user.
    """
    course = db.scalar(
        select(Course).where(
            Course.id == course_id,
            Course.user_id == owner_id,
            Course.deleted_at.is_(None),
        )
    )
    if not course:
        raise NotFoundError("Course not found")
    return course


# ---------------------------------------------------------------------------
# Assignment
# ---------------------------------------------------------------------------

def require_assignment(db: Session, owner_id: int, assignment_id: int) -> Assignment:
    """
    Return the Assignment that belongs to a course owned by *owner_id*,
    or raise NotFoundError.

    Ownership is checked via the joined Course row so a user cannot access
    another user's assignment even if they know the numeric ID.
    """
    assignment = db.scalar(
        select(Assignment)
        .join(Course)
        .where(
            Assignment.id == assignment_id,
            Assignment.deleted_at.is_(None),
            Course.user_id == owner_id,
            Course.deleted_at.is_(None),
        )
    )
    if not assignment:
        raise NotFoundError("Assignment not found")
    return assignment


# ---------------------------------------------------------------------------
# Timetable entry
# ---------------------------------------------------------------------------

def require_timetable_entry(db: Session, owner_id: int, entry_id: int) -> Timetable:
    """Return the Timetable entry owned by *owner_id* or raise NotFoundError."""
    entry = db.scalar(
        select(Timetable)
        .join(Course)
        .where(Timetable.id == entry_id, Course.user_id == owner_id, Course.deleted_at.is_(None))
    )
    if not entry:
        raise NotFoundError("Timetable entry not found")
    return entry


def require_semester(db: Session, owner_id: int, semester_id: int) -> Semester:
    semester = db.scalar(select(Semester).where(Semester.id == semester_id, Semester.user_id == owner_id))
    if not semester:
        raise NotFoundError("Semester not found")
    return semester


def require_assignment_for_user(db: Session, owner_id: int, assignment_id: int) -> Assignment:
    assignment = db.scalar(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.user_id == owner_id,
            Assignment.deleted_at.is_(None),
        )
    )
    if not assignment:
        raise NotFoundError("Assignment not found")
    return assignment


def require_attendance(db: Session, owner_id: int, record_id: int) -> Attendance:
    record = db.scalar(
        select(Attendance).join(Course).where(
            Attendance.id == record_id,
            Course.user_id == owner_id,
            Course.deleted_at.is_(None),
        )
    )
    if not record:
        raise NotFoundError("Attendance record not found")
    return record


def require_study_session(db: Session, owner_id: int, session_id: int) -> StudySession:
    session = db.scalar(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.user_id == owner_id,
        )
    )
    if not session:
        raise NotFoundError("Study session not found")
    return session


# ---------------------------------------------------------------------------
# Domain-level validation helpers
# ---------------------------------------------------------------------------

def validate_timetable_times(start_time, end_time) -> None:
    """
    Raise ValueError if *end_time* is not strictly after *start_time*.

    Centralises the time-ordering rule used in both create and update flows
    of the timetable service.
    """
    if end_time <= start_time:
        raise ConflictError("End time must be after start time")

