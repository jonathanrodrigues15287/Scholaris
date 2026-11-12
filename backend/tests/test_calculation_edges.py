from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.cgpa import GradeEntry
from app.schemas.course import CourseCreate
from app.services.attendance_service import _prediction
from app.services.cgpa_service import calculate_cgpa, calculate_gpa
from app.schemas.cgpa import SemesterResult


def test_zero_classes_held_has_zero_percentage_and_one_required_class():
    percentage, warning, level, attend_next, safe_absences = _prediction(0, 0, 75.0)

    assert percentage == 0.0
    assert warning is True
    assert level == "below"
    assert attend_next == 1
    assert safe_absences is None


def test_exact_attendance_threshold_is_not_below_threshold():
    percentage, warning, level, attend_next, safe_absences = _prediction(3, 1, 75.0)

    assert percentage == 75.0
    assert warning is True
    assert level == "approaching"
    assert attend_next is None
    assert safe_absences == 0


def test_gpa_with_zero_credits_returns_zero():
    result = calculate_gpa([SimpleNamespace(grade=10.0, credits=0)])

    assert result.gpa == 0.0
    assert result.total_credits == 0


def test_cgpa_with_zero_credits_returns_zero():
    result = calculate_cgpa([SemesterResult(semester=1, entries=[])])

    assert result.gpa == 0.0
    assert result.total_credits == 0
    assert result.per_semester[0].gpa == 0.0


@pytest.mark.parametrize("grade", [0.0, 10.0])
def test_grade_boundaries_are_accepted(grade):
    entry = GradeEntry(grade=grade, credits=1)

    assert entry.grade == grade


@pytest.mark.parametrize("grade", [-0.01, 10.01])
def test_grade_outside_boundaries_is_rejected(grade):
    with pytest.raises(ValidationError):
        GradeEntry(grade=grade, credits=1)


@pytest.mark.parametrize("grade", [0.0, 10.0])
def test_course_grade_boundaries_are_accepted(grade):
    course = CourseCreate(name="Algorithms", code="CS101", grade=grade)

    assert course.grade == grade
