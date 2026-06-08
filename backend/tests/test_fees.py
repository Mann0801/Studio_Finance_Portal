"""Tests for the pro-rata / full-fee logic — the correctness-critical core."""
from datetime import date

from app.constants import Batch
from app.fees import compute_due


def test_full_fee_for_month_after_join():
    # Joined in Jan; April is a later month -> full fee, not pro-rata.
    due = compute_due(Batch.yoga, date(2026, 1, 10), "2026-04")
    assert due.amount_paise == 2500_00
    assert due.is_prorata is False


def test_period_before_join_is_zero():
    due = compute_due(Batch.yoga, date(2026, 4, 16), "2026-03")
    assert due.amount_paise == 0
    assert due.is_prorata is False


def test_prorata_exact_half_month():
    # April has 30 days; join on the 16th -> 15 days remaining (inclusive).
    # 2500 * 15/30 = 1250.
    due = compute_due(Batch.yoga, date(2026, 4, 16), "2026-04")
    assert due.amount_paise == 1250_00
    assert due.is_prorata is True


def test_prorata_rounds_to_nearest_rupee():
    # Zumba 2000, June has 30 days, join 8th -> 23 days remaining.
    # 2000 * 23/30 = 1533.33... -> 1533.
    due = compute_due(Batch.zumba, date(2026, 6, 8), "2026-06")
    assert due.amount_paise == 1533_00
    assert due.is_prorata is True


def test_prorata_february_rounding():
    # Gymnastics 3000, Feb 2026 has 28 days, join 14th -> 15 days remaining.
    # 3000 * 15/28 = 1607.14... -> 1607.
    due = compute_due(Batch.gymnastics, date(2026, 2, 14), "2026-02")
    assert due.amount_paise == 1607_00


def test_join_on_first_is_full_month_but_flagged_prorata():
    due = compute_due(Batch.zumba, date(2026, 6, 1), "2026-06")
    assert due.amount_paise == 2000_00
    assert due.is_prorata is True


def test_join_on_last_day_is_one_day():
    # June 30 days; join on the 30th -> 1 day. 2000 * 1/30 = 66.67 -> 67.
    due = compute_due(Batch.zumba, date(2026, 6, 30), "2026-06")
    assert due.amount_paise == 67_00
