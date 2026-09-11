"""
helpers.py - Pure utility functions shared across the Scholaris backend.

Nothing in this module touches the database or imports FastAPI - these are
plain Python helpers that can be called from services, schemas, or anywhere
else without side effects.

Usage:
    from app.utils.helpers import normalise_name, normalise_code, attendance_percentage
"""

from typing import Any


# ---------------------------------------------------------------------------
# String normalisation
# ---------------------------------------------------------------------------

def normalise_name(value: str) -> str:
    """
    Strip leading/trailing whitespace from a display name.

    Example:
        normalise_name("  Data Structures  ") -> "Data Structures"
    """
    return value.strip()


def normalise_code(value: str) -> str:
    """
    Strip whitespace and uppercase a course / module code.

    Example:
        normalise_code("  cs101  ") -> "CS101"
    """
    return value.strip().upper()


def normalise_email(value: str) -> str:
    """
    Strip whitespace and lowercase an email address.

    Example:
        normalise_email("  Alice@Example.COM  ") -> "alice@example.com"
    """
    return value.strip().lower()


# ---------------------------------------------------------------------------
# Attendance percentage
# ---------------------------------------------------------------------------

def attendance_percentage(present: int, total: int, *, decimals: int = 2) -> float:
    """
    Return the attendance percentage rounded to *decimals* places.

    Returns 0.0 when *total* is zero to avoid ZeroDivisionError.

    Example:
        attendance_percentage(18, 20) -> 90.0
        attendance_percentage(0, 0)   -> 0.0
    """
    if total == 0:
        return 0.0
    return round(present * 100 / total, decimals)


# ---------------------------------------------------------------------------
# Generic model patching
# ---------------------------------------------------------------------------

def apply_partial_update(obj: Any, values: dict) -> None:
    """
    Apply a dict of *values* onto *obj* via setattr.

    This is the pattern used throughout services when handling PATCH requests:

        values = data.model_dump(exclude_unset=True)
        apply_partial_update(db_row, values)

    Centralising it here means service functions stay short and any future
    pre-processing (e.g. auditing, type coercion) can be added in one place.
    """
    for key, value in values.items():
        setattr(obj, key, value)
