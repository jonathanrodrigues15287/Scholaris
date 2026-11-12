from types import SimpleNamespace

from app.utils.helpers import (
    apply_partial_update,
    attendance_percentage,
    normalise_code,
    normalise_email,
    normalise_name,
)


def test_normalisers_trim_and_standardise_values():
    assert normalise_name("  Ada Lovelace  ") == "Ada Lovelace"
    assert normalise_code(" cs-101 ") == "CS-101"
    assert normalise_email("  Ada@Example.COM ") == "ada@example.com"


def test_attendance_percentage_handles_zero_and_rounding():
    assert attendance_percentage(0, 0) == 0.0
    assert attendance_percentage(17, 20) == 85.0
    assert attendance_percentage(2, 3, decimals=2) == 66.67


def test_apply_partial_update_changes_only_requested_attributes():
    item = SimpleNamespace(name="old", credits=3)

    apply_partial_update(item, {"name": "new"})

    assert item.name == "new"
    assert item.credits == 3
