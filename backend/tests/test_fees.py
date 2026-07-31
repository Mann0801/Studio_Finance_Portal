"""Tests for the pro-rata / full-fee logic — the correctness-critical core.

`compute_due` now takes a class row (dict) from the ``classes`` table. These
fixtures mirror the seeded classes (see supabase/migrations/dynamic_classes.sql).
"""
from datetime import date

import pytest

from app.fees import compute_due, previous_period


def monthly(fee_paise, days=(0, 1, 2, 3, 4)):
    return {"fee_type": "monthly", "fee_paise": fee_paise, "schedule_days": list(days)}


def session_pack(fee_paise, spm, days):
    return {
        "fee_type": "session_pack",
        "fee_paise": fee_paise,
        "sessions_per_month": spm,
        "schedule_days": list(days),
    }


def per_session(fee_paise, days):
    return {"fee_type": "per_session", "fee_paise": fee_paise, "schedule_days": list(days)}


TRADITIONAL = monthly(2300_00)
WEIGHT_LOSS = monthly(3000_00)
SENIOR = monthly(2000_00)
KIDS = monthly(2000_00, days=())
GYMNASTICS = session_pack(2800_00, 8, (1, 6))   # Tue & Sun
ZUMBA = session_pack(2000_00, 8, (5, 6))        # Sat & Sun
PRENATAL = per_session(1000_00, (5, 6))         # Sat & Sun
TEST_COURSE = session_pack(10_00, 1, (0, 1, 2, 3, 4, 5, 6))
ENQUIRY = {"fee_type": "enquiry", "fee_paise": 0}


# ── Monthly billing ────────────────────────────────────────────────────────────
def test_full_fee_for_month_after_join():
    due = compute_due(TRADITIONAL, date(2026, 1, 10), "2026-04")
    assert due.amount_paise == 2300_00
    assert due.is_prorata is False


def test_period_before_join_is_zero():
    due = compute_due(WEIGHT_LOSS, date(2026, 4, 16), "2026-03")
    assert due.amount_paise == 0
    assert due.is_prorata is False


def test_prorata_exact_half_month():
    # April has 30 days; join on the 16th -> 15 days remaining. 2300 * 15/30 = 1150.
    due = compute_due(TRADITIONAL, date(2026, 4, 16), "2026-04")
    assert due.amount_paise == 1150_00
    assert due.is_prorata is True


def test_prorata_rounds_to_nearest_rupee():
    # 2000, June 30 days, join 8th -> 23 days. 2000 * 23/30 = 1533.33 -> 1533.
    due = compute_due(SENIOR, date(2026, 6, 8), "2026-06")
    assert due.amount_paise == 1533_00
    assert due.is_prorata is True


def test_prorata_february_rounding():
    # 3000, Feb 2026 28 days, join 14th -> 15 days. 3000 * 15/28 = 1607.14 -> 1607.
    due = compute_due(WEIGHT_LOSS, date(2026, 2, 14), "2026-02")
    assert due.amount_paise == 1607_00


def test_kids_yoga_full_month():
    due = compute_due(KIDS, date(2026, 1, 1), "2026-05")
    assert due.amount_paise == 2000_00
    assert due.is_prorata is False


def test_join_on_first_is_full_month_not_prorata():
    # Joining on the 1st is a full month — charged the whole fee and NOT flagged
    # as pro-rated (the "· pro-rated" label would be misleading).
    due = compute_due(SENIOR, date(2026, 6, 1), "2026-06")
    assert due.amount_paise == 2000_00
    assert due.is_prorata is False


def test_join_on_last_day_is_one_day():
    # June 30 days; join 30th -> 1 day. 2000 * 1/30 = 66.67 -> 67.
    due = compute_due(KIDS, date(2026, 6, 30), "2026-06")
    assert due.amount_paise == 67_00


# ── Session-pack billing (Gymnastics, Zumba) ───────────────────────────────────
# June 2026 starts Monday. Tue: 2,9,16,23,30 · Sun: 7,14,21,28 · Sat: 6,13,20,27.
def test_session_pack_full_month_is_pack_price():
    due = compute_due(GYMNASTICS, date(2026, 1, 1), "2026-06")
    assert due.amount_paise == 2800_00
    assert due.is_prorata is False


def test_session_pack_prorata_by_remaining_sessions():
    # Join June 16: Tue/Sun remaining = 16,21,23,28,30 = 5. (2800/8)*5 = 1750.
    due = compute_due(GYMNASTICS, date(2026, 6, 16), "2026-06")
    assert due.amount_paise == 1750_00
    assert due.is_prorata is True


def test_session_pack_join_first_capped_at_package_size():
    # June has 9 Tue/Sun but the pack caps at 8 -> 2800.
    due = compute_due(GYMNASTICS, date(2026, 6, 1), "2026-06")
    assert due.amount_paise == 2800_00


def test_zumba_prorata_by_remaining_weekends():
    # Join June 20: Sat/Sun remaining = 20,21,27,28 = 4. (2000/8)*4 = 1000.
    due = compute_due(ZUMBA, date(2026, 6, 20), "2026-06")
    assert due.amount_paise == 1000_00
    assert due.is_prorata is True


# ── Per-session billing (Prenatal) ─────────────────────────────────────────────
def test_per_session_full_month_bills_every_class_day():
    # Every Sat/Sun at 1000. June has 8 -> 8000.
    due = compute_due(PRENATAL, date(2026, 5, 1), "2026-06")
    assert due.amount_paise == 8000_00
    assert due.is_prorata is False


def test_per_session_prorata_by_remaining_days():
    # Join June 20: Sat/Sun remaining = 4. 4 * 1000 = 4000.
    due = compute_due(PRENATAL, date(2026, 6, 20), "2026-06")
    assert due.amount_paise == 4000_00
    assert due.is_prorata is True


# ── Test Course (session_pack, 1 session, every day) is always flat ────────────
def test_test_course_is_flat_ten_rupees():
    for join, period in [
        (date(2026, 6, 1), "2026-06"),
        (date(2026, 6, 15), "2026-06"),
        (date(2026, 1, 1), "2026-06"),
    ]:
        assert compute_due(TEST_COURSE, join, period).amount_paise == 10_00


# ── Enquiry / deleted classes never bill ───────────────────────────────────────
def test_enquiry_class_is_zero():
    assert compute_due(ENQUIRY, date(2026, 1, 1), "2026-06").amount_paise == 0


def test_deleted_class_none_is_zero():
    assert compute_due(None, date(2026, 1, 1), "2026-06").amount_paise == 0


@pytest.mark.parametrize(
    "period,expected",
    [("2026-06", "2026-05"), ("2026-01", "2025-12"), ("2026-12", "2026-11")],
)
def test_previous_period(period, expected):
    assert previous_period(period) == expected
