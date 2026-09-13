"""
test_unit.py - Unit tests for Scholaris backend pure-logic functions.

Covers:
  - attendance_percentage()        (helpers.py)
  - _prediction()                  (attendance_service.py)  ← attendance warning logic
  - calculate_gpa() / SGPA         (cgpa_service.py)
  - calculate_cgpa()               (cgpa_service.py)
  - _priority_for()                (assignment_service.py)  ← deadline / priority
  - _apply_status()                (assignment_service.py)  ← status transitions
  - _next_recurrence_date()        (assignment_service.py)
  - timetable time-overlap logic   (timetable_service.py)   ← conflict detection
  - validate_timetable_times()     (validators.py)
  - study session duration calcs   (study_service.py helper ← study_stats logic)
  - normalise_name/code/email      (helpers.py)
  - apply_partial_update()         (helpers.py)

All tests are pure-Python (no database, no HTTP client).
Run with:  pytest backend/tests/test_unit.py -v
"""

from __future__ import annotations

import pytest
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Helpers – make the app package importable when running from the repo root
# ---------------------------------------------------------------------------
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set required env vars before any app import
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_unit.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")


# ===========================================================================
# 1.  attendance_percentage()
# ===========================================================================
from app.utils.helpers import attendance_percentage, normalise_name, normalise_code, normalise_email, apply_partial_update


class TestAttendancePercentage:
    """Tests for the pure-math helper attendance_percentage()."""

    def test_perfect_attendance(self):
        assert attendance_percentage(20, 20) == 100.0

    def test_zero_attendance(self):
        assert attendance_percentage(0, 20) == 0.0

    def test_zero_total_returns_zero(self):
        """Guard against ZeroDivisionError when no classes have occurred."""
        assert attendance_percentage(0, 0) == 0.0

    def test_typical_75_percent(self):
        assert attendance_percentage(15, 20) == 75.0

    def test_rounding_two_decimals(self):
        # 1 / 3 ≈ 33.33%
        assert attendance_percentage(1, 3) == 33.33

    def test_fractional_result(self):
        # 18 / 20 = 90.0
        assert attendance_percentage(18, 20) == 90.0

    def test_custom_decimals(self):
        assert attendance_percentage(1, 3, decimals=4) == 33.3333

    def test_one_class_attended_out_of_one(self):
        assert attendance_percentage(1, 1) == 100.0

    def test_large_numbers(self):
        assert attendance_percentage(900, 1000) == 90.0

    def test_below_threshold_74(self):
        result = attendance_percentage(74, 100)
        assert result < 75.0

    def test_exactly_at_threshold_75(self):
        result = attendance_percentage(75, 100)
        assert result == 75.0


# ===========================================================================
# 2.  Attendance Warning / Prediction logic (_prediction helper)
# ===========================================================================
from app.services.attendance_service import _prediction


class TestAttendancePrediction:
    """
    _prediction(present, absent, threshold) returns:
        (percentage, warning: bool, warning_level: str,
         attend_next: int | None, safe_absences: int | None)
    """

    def test_below_threshold_raises_warning(self):
        pct, warning, level, attend_next, safe = _prediction(10, 10, 75.0)
        assert warning is True
        assert level == "below"
        assert pct == 50.0

    def test_at_exactly_threshold_safe(self):
        # 75/100 → 75% — threshold is 75, margin = 0 ≤ 5 → "approaching"
        pct, warning, level, attend_next, safe = _prediction(75, 25, 75.0)
        assert pct == 75.0
        assert warning is True          # within 5 % margin
        assert level == "approaching"

    def test_safely_above_threshold(self):
        # 90/100 → 90 %, margin = 15 → safe
        pct, warning, level, attend_next, safe = _prediction(90, 10, 75.0)
        assert pct == 90.0
        assert warning is False
        assert level == "safe"
        assert attend_next is None

    def test_attend_next_calculated_when_below(self):
        """attend_next should be the minimum classes to cross the threshold."""
        # present=5, absent=15 → 25 %, need 75 % of future total
        pct, _, _, attend_next, _ = _prediction(5, 15, 75.0)
        assert attend_next is not None
        assert attend_next >= 1

    def test_safe_absences_calculated_when_above(self):
        """safe_absences = how many more absences before falling below threshold."""
        pct, _, _, attend_next, safe_absences = _prediction(90, 10, 75.0)
        assert safe_absences is not None
        assert safe_absences >= 0
        assert attend_next is None

    def test_zero_total_zero_threshold(self):
        """Edge: no classes and zero threshold → safe."""
        pct, warning, level, _, _ = _prediction(0, 0, 0.0)
        assert pct == 0.0

    def test_approaching_boundary_exactly_5_percent_margin(self):
        # 80 / 100 → 80 %, margin = 80 - 75 = 5 → approaching
        pct, warning, level, _, _ = _prediction(80, 20, 75.0)
        assert warning is True
        assert level == "approaching"

    def test_six_percent_margin_is_safe(self):
        # 81 / 100 → 81 %, margin = 6 → safe
        pct, warning, level, _, _ = _prediction(81, 19, 75.0)
        assert warning is False
        assert level == "safe"

    def test_100_percent_threshold_impossible_attend_next(self):
        """When threshold == 100 %, attend_next is None (cannot recover)."""
        _, _, _, attend_next, _ = _prediction(0, 5, 100.0)
        assert attend_next is None

    def test_warning_level_below_when_zero_attendance(self):
        _, _, level, _, _ = _prediction(0, 10, 75.0)
        assert level == "below"


# ===========================================================================
# 3.  SGPA / GPA calculation  (calculate_gpa)
# ===========================================================================
from app.services.cgpa_service import calculate_gpa, calculate_cgpa
from app.schemas.cgpa import GradeEntry, SemesterResult


def _entry(grade: float, credits: float) -> GradeEntry:
    return GradeEntry(grade=grade, credits=credits)


class TestCalculateGpa:
    """Tests for calculate_gpa() which computes a single-semester SGPA."""

    def test_perfect_gpa(self):
        entries = [_entry(10.0, 4), _entry(10.0, 3)]
        result = calculate_gpa(entries)
        assert result.gpa == 10.0
        assert result.total_credits == 7

    def test_zero_grade_entry(self):
        entries = [_entry(0.0, 3)]
        result = calculate_gpa(entries)
        assert result.gpa == 0.0

    def test_weighted_average(self):
        # (8*3 + 6*3) / 6 = 7.0
        entries = [_entry(8.0, 3), _entry(6.0, 3)]
        result = calculate_gpa(entries)
        assert result.gpa == 7.0

    def test_unequal_credits(self):
        # (9*4 + 6*2) / 6 = (36+12)/6 = 8.0
        entries = [_entry(9.0, 4), _entry(6.0, 2)]
        result = calculate_gpa(entries)
        assert result.gpa == 8.0

    def test_single_subject(self):
        entries = [_entry(7.5, 5)]
        result = calculate_gpa(entries)
        assert result.gpa == 7.5
        assert result.total_credits == 5

    def test_total_credits_sum(self):
        entries = [_entry(8.0, 2), _entry(9.0, 3), _entry(7.0, 4)]
        result = calculate_gpa(entries)
        assert result.total_credits == 9

    def test_rounding_to_two_decimal_places(self):
        # (8*1 + 7*1 + 6*1) / 3 = 7.0
        entries = [_entry(8.0, 1), _entry(7.0, 1), _entry(6.0, 1)]
        result = calculate_gpa(entries)
        assert result.gpa == 7.0

    def test_fractional_credits(self):
        entries = [_entry(9.0, 1.5), _entry(7.0, 1.5)]
        result = calculate_gpa(entries)
        assert result.gpa == 8.0
        assert result.total_credits == 3.0


# ===========================================================================
# 4.  CGPA calculation (calculate_cgpa)
# ===========================================================================

class TestCalculateCgpa:
    """Tests for calculate_cgpa() which returns cumulative GPA across semesters."""

    def _semester(self, num: int, entries: list[GradeEntry]) -> SemesterResult:
        return SemesterResult(semester=num, entries=entries)

    def test_single_semester_cgpa_equals_sgpa(self):
        sem = self._semester(1, [_entry(8.0, 4), _entry(7.0, 3)])
        result = calculate_cgpa([sem])
        expected_sgpa = (8 * 4 + 7 * 3) / 7
        assert result.gpa == round(expected_sgpa, 2)

    def test_two_semesters_equal_weight(self):
        sem1 = self._semester(1, [_entry(9.0, 3), _entry(8.0, 3)])
        sem2 = self._semester(2, [_entry(7.0, 3), _entry(6.0, 3)])
        result = calculate_cgpa([sem1, sem2])
        # sgpa1 = (27+24)/6 = 8.5, sgpa2 = (21+18)/6 = 6.5
        # cgpa = (51+39)/12 = 7.5
        assert result.gpa == 7.5
        assert result.total_credits == 12

    def test_per_semester_breakdown(self):
        sem1 = self._semester(1, [_entry(10.0, 4)])
        sem2 = self._semester(2, [_entry(8.0, 4)])
        result = calculate_cgpa([sem1, sem2])
        assert len(result.per_semester) == 2
        assert result.per_semester[0].gpa == 10.0
        assert result.per_semester[1].gpa == 8.0

    def test_cgpa_weighted_by_credits(self):
        # sem1: 10 grade × 2 credits; sem2: 4 grade × 8 credits → cgpa = (20+32)/10 = 5.2
        sem1 = self._semester(1, [_entry(10.0, 2)])
        sem2 = self._semester(2, [_entry(4.0, 8)])
        result = calculate_cgpa([sem1, sem2])
        assert result.gpa == 5.2

    def test_per_semester_total_credits(self):
        sem = self._semester(1, [_entry(8.0, 3), _entry(9.0, 2)])
        result = calculate_cgpa([sem])
        assert result.per_semester[0].total_credits == 5

    def test_three_semesters(self):
        sems = [
            self._semester(1, [_entry(9.0, 4)]),
            self._semester(2, [_entry(8.0, 4)]),
            self._semester(3, [_entry(7.0, 4)]),
        ]
        result = calculate_cgpa(sems)
        # (36+32+28)/12 = 96/12 = 8.0
        assert result.gpa == 8.0
        assert result.total_credits == 12


# ===========================================================================
# 5.  Assignment – priority calculation (_priority_for)
# ===========================================================================
from app.services.assignment_service import _priority_for
from app.schemas.assignment import AssignmentCreate


def _mock_create(priority: str = "medium", priority_mode: str = "manual", due_date: date | None = None) -> AssignmentCreate:
    """Build a minimal AssignmentCreate-like namespace for _priority_for."""
    obj = SimpleNamespace(
        priority=priority,
        priority_mode=priority_mode,
        due_date=due_date,
    )
    return obj  # type: ignore[return-value]


class TestPriorityFor:
    """Tests for the deadline-based auto-priority logic."""

    def test_auto_high_within_2_days(self):
        due = date.today() + timedelta(days=1)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "high"

    def test_auto_high_on_due_day(self):
        due = date.today()
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "high"

    def test_auto_medium_within_7_days(self):
        due = date.today() + timedelta(days=5)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "medium"

    def test_auto_low_more_than_7_days(self):
        due = date.today() + timedelta(days=14)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "low"

    def test_auto_medium_when_no_due_date(self):
        data = _mock_create(priority_mode="auto", due_date=None)
        assert _priority_for(data) == "medium"

    def test_manual_priority_respected(self):
        due = date.today() + timedelta(days=1)  # would be "high" in auto
        data = _mock_create(priority="low", priority_mode="manual", due_date=due)
        assert _priority_for(data) == "low"

    def test_manual_high_explicit(self):
        data = _mock_create(priority="high", priority_mode="manual")
        assert _priority_for(data) == "high"

    def test_auto_exactly_2_days_is_high(self):
        due = date.today() + timedelta(days=2)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "high"

    def test_auto_exactly_7_days_is_medium(self):
        due = date.today() + timedelta(days=7)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "medium"

    def test_auto_8_days_is_low(self):
        due = date.today() + timedelta(days=8)
        data = _mock_create(priority_mode="auto", due_date=due)
        assert _priority_for(data) == "low"


# ===========================================================================
# 6.  Assignment – status transitions (_apply_status)
# ===========================================================================
from app.services.assignment_service import _apply_status
from app.core.exceptions import ConflictError


def _mock_assignment(status: str) -> MagicMock:
    a = MagicMock()
    a.status = status
    a.is_completed = status in {"completed", "submitted"}
    a.is_submitted = status == "submitted"
    a.completed_at = None
    a.submitted_at = None
    return a


class TestApplyStatus:
    """Tests for assignment status transition validation."""

    def test_pending_to_in_progress(self):
        a = _mock_assignment("pending")
        _apply_status(a, "in_progress")
        assert a.status == "in_progress"

    def test_in_progress_to_completed(self):
        a = _mock_assignment("in_progress")
        _apply_status(a, "completed")
        assert a.status == "completed"
        assert a.is_completed is True

    def test_completed_to_submitted(self):
        a = _mock_assignment("completed")
        _apply_status(a, "submitted")
        assert a.status == "submitted"
        assert a.is_submitted is True

    def test_pending_to_completed_is_allowed(self):
        """Shortcut: pending → completed is explicitly permitted."""
        a = _mock_assignment("pending")
        _apply_status(a, "completed")
        assert a.status == "completed"

    def test_submitted_cannot_change_state(self):
        a = _mock_assignment("submitted")
        with pytest.raises(ConflictError, match="Submitted"):
            _apply_status(a, "pending")

    def test_cannot_submit_from_pending(self):
        a = _mock_assignment("pending")
        with pytest.raises(ConflictError, match="completed"):
            _apply_status(a, "submitted")

    def test_cannot_submit_from_in_progress(self):
        a = _mock_assignment("in_progress")
        with pytest.raises(ConflictError, match="completed"):
            _apply_status(a, "submitted")

    def test_invalid_status_raises_conflict(self):
        a = _mock_assignment("pending")
        with pytest.raises(ConflictError, match="Invalid"):
            _apply_status(a, "nonexistent_status")

    def test_completed_at_set_on_first_completion(self):
        a = _mock_assignment("pending")
        _apply_status(a, "completed")
        assert a.completed_at is not None

    def test_submitted_at_set_on_submission(self):
        a = _mock_assignment("completed")
        _apply_status(a, "submitted")
        assert a.submitted_at is not None

    def test_skip_from_pending_to_submitted_raises(self):
        a = _mock_assignment("pending")
        with pytest.raises(ConflictError):
            _apply_status(a, "submitted")


# ===========================================================================
# 7.  Assignment – recurrence date calculation (_next_recurrence_date)
# ===========================================================================
from app.services.assignment_service import _next_recurrence_date


class TestNextRecurrenceDate:
    """Tests for recurrence date arithmetic."""

    def test_daily_adds_one_day(self):
        base = date(2026, 9, 1)
        assert _next_recurrence_date(base, "daily") == date(2026, 9, 2)

    def test_weekly_adds_seven_days(self):
        base = date(2026, 9, 1)
        assert _next_recurrence_date(base, "weekly") == date(2026, 9, 8)

    def test_monthly_adds_30_days(self):
        base = date(2026, 9, 1)
        assert _next_recurrence_date(base, "monthly") == date(2026, 10, 1)

    def test_unknown_rule_defaults_to_30_days(self):
        base = date(2026, 9, 1)
        result = _next_recurrence_date(base, "quarterly")  # unknown rule
        assert result == base + timedelta(days=30)

    def test_daily_crosses_month_boundary(self):
        base = date(2026, 8, 31)
        assert _next_recurrence_date(base, "daily") == date(2026, 9, 1)

    def test_weekly_crosses_year_boundary(self):
        base = date(2026, 12, 28)
        assert _next_recurrence_date(base, "weekly") == date(2027, 1, 4)


# ===========================================================================
# 8.  Timetable – conflict detection logic (pure time-overlap math)
# ===========================================================================
from datetime import time as dtime


def _overlaps(s1: dtime, e1: dtime, s2: dtime, e2: dtime) -> bool:
    """Replicate the overlap predicate from has_conflict(): s1<e2 AND e1>s2."""
    return s1 < e2 and e1 > s2


class TestTimetableConflictOverlapLogic:
    """Unit-tests the [start, end) overlap predicate used in has_conflict()."""

    def test_no_overlap_sequential(self):
        # 09:00-10:00 then 10:00-11:00
        assert not _overlaps(dtime(9, 0), dtime(10, 0), dtime(10, 0), dtime(11, 0))

    def test_clear_overlap(self):
        # 09:00-11:00 overlaps 10:00-12:00
        assert _overlaps(dtime(9, 0), dtime(11, 0), dtime(10, 0), dtime(12, 0))

    def test_fully_contained(self):
        # 09:00-10:00 inside 08:00-11:00
        assert _overlaps(dtime(9, 0), dtime(10, 0), dtime(8, 0), dtime(11, 0))

    def test_identical_slots_overlap(self):
        assert _overlaps(dtime(10, 0), dtime(11, 0), dtime(10, 0), dtime(11, 0))

    def test_adjacent_end_to_start_no_overlap(self):
        # 08:00-09:00 and 09:00-10:00 — touching but not overlapping
        assert not _overlaps(dtime(8, 0), dtime(9, 0), dtime(9, 0), dtime(10, 0))

    def test_one_minute_overlap(self):
        # 09:00-10:01 overlaps 10:00-11:00
        assert _overlaps(dtime(9, 0), dtime(10, 1), dtime(10, 0), dtime(11, 0))

    def test_no_overlap_before(self):
        # 07:00-08:00 before 09:00-10:00
        assert not _overlaps(dtime(7, 0), dtime(8, 0), dtime(9, 0), dtime(10, 0))

    def test_no_overlap_after(self):
        # 11:00-12:00 after 09:00-10:00
        assert not _overlaps(dtime(11, 0), dtime(12, 0), dtime(9, 0), dtime(10, 0))

    def test_partial_overlap_from_right(self):
        assert _overlaps(dtime(10, 30), dtime(12, 0), dtime(9, 0), dtime(11, 0))

    def test_partial_overlap_from_left(self):
        assert _overlaps(dtime(8, 0), dtime(10, 30), dtime(10, 0), dtime(12, 0))


# ===========================================================================
# 9.  Timetable – validate_timetable_times()
# ===========================================================================
from app.utils.validators import validate_timetable_times


class TestValidateTimetableTimes:
    """Tests for the timetable start/end ordering guard."""

    def test_valid_times_pass(self):
        validate_timetable_times(dtime(9, 0), dtime(10, 0))  # should not raise

    def test_end_before_start_raises(self):
        with pytest.raises(ConflictError):
            validate_timetable_times(dtime(11, 0), dtime(9, 0))

    def test_equal_times_raise(self):
        with pytest.raises(ConflictError):
            validate_timetable_times(dtime(10, 0), dtime(10, 0))

    def test_one_minute_apart_passes(self):
        validate_timetable_times(dtime(10, 0), dtime(10, 1))

    def test_midnight_wrap_raises(self):
        # 23:30 → 01:00  — would be 01:00 < 23:30, so this should raise
        with pytest.raises(ConflictError):
            validate_timetable_times(dtime(23, 30), dtime(1, 0))


# ===========================================================================
# 10. Study session – duration / streak calculations (pure math)
# ===========================================================================

class TestStudySessionDurationCalculations:
    """
    study_stats aggregates session durations in seconds → minutes.
    Test the arithmetic directly (no DB needed).
    """

    def _minutes(self, sessions_seconds: list[int]) -> int:
        """Simulate the per-day minutes calculation used in study_stats."""
        return sum(s // 60 for s in sessions_seconds)

    def test_single_25_minute_pomodoro(self):
        assert self._minutes([25 * 60]) == 25

    def test_multiple_sessions_sum(self):
        # 25 min + 50 min + 15 min = 90 min
        assert self._minutes([25 * 60, 50 * 60, 15 * 60]) == 90

    def test_seconds_truncated_not_rounded(self):
        # 89 seconds → 1 minute (floor division)
        assert self._minutes([89]) == 1

    def test_zero_seconds_is_zero_minutes(self):
        assert self._minutes([0]) == 0

    def test_exactly_one_hour(self):
        assert self._minutes([3600]) == 60

    def test_streak_counter_logic(self):
        """Replicate the streak-counting loop from study_stats."""
        today = date.today()
        minutes_by_date = {
            today: 60,
            today - timedelta(days=1): 45,
            today - timedelta(days=2): 30,
            # gap on day 3
            today - timedelta(days=4): 20,
        }
        streak = 0
        check_date = today
        while minutes_by_date.get(check_date, 0) > 0:
            streak += 1
            check_date -= timedelta(days=1)
        assert streak == 3  # today, yesterday, day before — gap breaks streak

    def test_no_sessions_streak_zero(self):
        minutes_by_date: dict[date, int] = {}
        streak = 0
        check_date = date.today()
        while minutes_by_date.get(check_date, 0) > 0:
            streak += 1
            check_date -= timedelta(days=1)
        assert streak == 0

    def test_goal_progress_minutes_equals_weekly_total(self):
        """goal_progress_minutes should mirror the weekly total."""
        today = date.today()
        weekly_start = today - timedelta(days=today.weekday())
        minutes_by_date = {
            today: 60,
            today - timedelta(days=1): 30,
        }
        weekly = sum(v for d, v in minutes_by_date.items() if weekly_start <= d <= today)
        # goal_progress_minutes is set to weekly in study_stats
        assert weekly == 90


# ===========================================================================
# 11. Attendance warning  – projected attendance scenario
# ===========================================================================

class TestAttendanceWarningProjected:
    """
    Verify warning is triggered when projected attendance < 75 %
    even if current attendance is safe.
    """

    def test_currently_safe_but_projected_below(self):
        """
        If a student has 80 % now but will miss the next 6 classes,
        check that _prediction reflects the drop.
        """
        # After 6 more absences: present=80, absent=26 → 75.47 % → approaching
        pct, warning, level, _, _ = _prediction(80, 26, 75.0)
        # margin = 75.47 - 75 = 0.47 < 5 → approaching
        assert warning is True
        assert level == "approaching"

    def test_scenario_dropping_below_75(self):
        # present=74, absent=26 → 74 % → below
        pct, warning, level, attend_next, _ = _prediction(74, 26, 75.0)
        assert pct < 75.0
        assert warning is True
        assert level == "below"
        assert attend_next is not None

    def test_attend_next_sufficient_to_restore_75(self):
        """
        After attend_next consecutive attendances, the new percentage
        should be >= 75 %.
        """
        present, absent = 50, 50   # 50 % — below threshold
        _, _, _, attend_next, _ = _prediction(present, absent, 75.0)
        assert attend_next is not None
        new_present = present + attend_next
        new_total = present + absent + attend_next
        new_pct = attendance_percentage(new_present, new_total)
        assert new_pct >= 75.0


# ===========================================================================
# 12. Helpers – normalisation and apply_partial_update
# ===========================================================================

class TestStringNormalisation:
    def test_normalise_name_strips_whitespace(self):
        assert normalise_name("  Data Structures  ") == "Data Structures"

    def test_normalise_name_empty_string(self):
        assert normalise_name("   ") == ""

    def test_normalise_code_strips_and_uppercases(self):
        assert normalise_code("  cs101  ") == "CS101"

    def test_normalise_code_already_upper(self):
        assert normalise_code("CS101") == "CS101"

    def test_normalise_email_lowercases_and_strips(self):
        assert normalise_email("  Alice@Example.COM  ") == "alice@example.com"

    def test_normalise_email_already_lower(self):
        assert normalise_email("student@uni.edu") == "student@uni.edu"


class TestApplyPartialUpdate:
    def test_updates_existing_attribute(self):
        obj = SimpleNamespace(status="pending", title="Old Title")
        apply_partial_update(obj, {"title": "New Title"})
        assert obj.title == "New Title"

    def test_leaves_untouched_fields_intact(self):
        obj = SimpleNamespace(status="pending", title="My Assignment")
        apply_partial_update(obj, {"status": "in_progress"})
        assert obj.title == "My Assignment"
        assert obj.status == "in_progress"

    def test_multiple_fields_updated(self):
        obj = SimpleNamespace(a=1, b=2, c=3)
        apply_partial_update(obj, {"a": 10, "c": 30})
        assert obj.a == 10
        assert obj.b == 2
        assert obj.c == 30

    def test_empty_values_dict_is_noop(self):
        obj = SimpleNamespace(x=99)
        apply_partial_update(obj, {})
        assert obj.x == 99
