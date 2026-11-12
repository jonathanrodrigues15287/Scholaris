from datetime import time

import pytest
from pydantic import ValidationError

from app.schemas.common import make_page
from app.schemas.timetable import TimetableCreate
from app.schemas.user import UserCreate


def test_user_create_accepts_a_strong_password_and_identity():
    user = UserCreate(
        username="student.one",
        email="student@example.com",
        password="StrongPassword1!",
    )

    assert user.username == "student.one"


def test_user_create_rejects_weak_passwords():
    with pytest.raises(ValidationError, match="Password must include"):
        UserCreate(
            username="student.one",
            email="student@example.com",
            password="weakpasswordonly",
        )


def test_timetable_create_requires_end_time_after_start_time():
    with pytest.raises(ValidationError, match="end_time must be after start_time"):
        TimetableCreate(
            day="Monday",
            start_time=time(10, 0),
            end_time=time(9, 0),
            course_id=1,
        )


def test_make_page_calculates_page_count():
    page = make_page(["first", "second"], total=5, page=1, page_size=2)

    assert page.model_dump() == {
        "items": ["first", "second"],
        "total": 5,
        "page": 1,
        "page_size": 2,
        "pages": 3,
    }
