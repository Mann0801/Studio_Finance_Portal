"""Tests for the pro-rata / full-fee logic — the correctness-critical core."""
from datetime import date

import pytest

from app.constants import Batch
from app.fees import compute_due, previous_period


# ── Monthly billing (Yoga family + Kids Yoga) ──────────────────────────────────
def test_full_fee_for_month_after_join():
    # Joined in Jan; April is a later month -> full fee, not pro-rata.
    due = compute_due(Batch.traditional_yoga, date(2026, 1, 10), "2026-04")
    assert due.amount_paise == 2300_00
    assert due.is_prorata is False


def test_period_before_join_is_zero():
    due = compute_due(Batch.weight_loss_yoga, date(2026, 4, 16), "2026-03")
    assert due.amount_paise == 0
    assert due.is_prorata is False


def test_prorata_exact_half_month():
    # April has 30 days; join on the 16th -> 15 days remaining (inclusive).
    # 2300 * 15/30 = 1150.
    due = compute_due(Batch.traditional_yoga, date(2026, 4, 16), "2026-04")
    assert due.amount_paise == 1150_00
    assert due.is_prorata is True


def test_prorata_rounds_to_nearest_rupee():
    # Senior Citizens Yoga 2000, June has 30 days, join 8th -> 23 days remaining.
    # 2000 * 23/30 = 1533.33... -> 1533.
    due = compute_due(Batch.senior_citizens_yoga, date(2026, 6, 8), "2026-06")
    assert due.amount_paise == 1533_00
    assert due.is_prorata is True


def test_prorata_february_rounding():
    # Weight Loss Yoga 3000, Feb 2026 has 28 days, join 14th -> 15 days remaining.
    # 3000 * 15/28 = 1607.14... -> 1607.
    due = compute_due(Batch.weight_loss_yoga, date(2026, 2, 14), "2026-02")
    assert due.amount_paise == 1607_00


def test_kids_yoga_full_month():
    due = compute_due(Batch.kids_yoga, date(2026, 1, 1), "2026-05")
    assert due.amount_paise == 2000_00
    assert due.is_prorata is False


def test_join_on_first_is_full_month_but_flagged_prorata():
    due = compute_due(Batch.senior_citizens_yoga, date(2026, 6, 1), "2026-06")
    assert due.amount_paise == 2000_00
    assert due.is_prorata is True


def test_join_on_last_day_is_one_day():
    # June 30 days; join on the 30th -> 1 day. 2000 * 1/30 = 66.67 -> 67.
    due = compute_due(Batch.kids_yoga, date(2026, 6, 30), "2026-06")
    assert due.amount_paise == 67_00


# ── Session billing (Gymnastics, Zumba, Prenatal) ──────────────────────────────
# June 2026 starts on a Monday. Tue: 2,9,16,23,30 · Sun: 7,14,21,28 · Sat: 6,13,20,27.
def test_gymnastics_full_month_is_capped_package():
    # 8 classes/month at 350 each = 2800, regardless of how many Tue/Sun fall.
    due = compute_due(Batch.gymnastics, date(2026, 1, 1), "2026-06")
    assert due.amount_paise == 2800_00
    assert due.is_prorata is False


def test_gymnastics_prorata_by_remaining_sessions():
    # Join June 16: Tue/Sun remaining = 16,21,23,28,30 = 5 sessions. 5 * 350 = 1750.
    due = compute_due(Batch.gymnastics, date(2026, 6, 16), "2026-06")
    assert due.amount_paise == 1750_00
    assert due.is_prorata is True


def test_gymnastics_join_first_capped_at_package_size():
    # June has 9 Tue/Sun days but the package caps at 8 -> 2800.
    due = compute_due(Batch.gymnastics, date(2026, 6, 1), "2026-06")
    assert due.amount_paise == 2800_00


def test_zumba_prorata_by_remaining_weekends():
    # Join June 20: Sat/Sun remaining = 20,21,27,28 = 4 sessions. 4 * 250 = 1000.
    due = compute_due(Batch.zumba, date(2026, 6, 20), "2026-06")
    assert due.amount_paise == 1000_00
    assert due.is_prorata is True


def test_prenatal_full_month_bills_every_weekend():
    # Prenatal has no cap: every Sat/Sun is billable at 1000. June has 8 -> 8000.
    due = compute_due(Batch.prenatal_yoga, date(2026, 5, 1), "2026-06")
    assert due.amount_paise == 8000_00
    assert due.is_prorata is False


def test_prenatal_prorata_by_remaining_weekends():
    # Join June 20: Sat/Sun remaining = 4 sessions. 4 * 1000 = 4000.
    due = compute_due(Batch.prenatal_yoga, date(2026, 6, 20), "2026-06")
    assert due.amount_paise == 4000_00
    assert due.is_prorata is True


@pytest.mark.parametrize(
    "period,expected",
    [("2026-06", "2026-05"), ("2026-01", "2025-12"), ("2026-12", "2026-11")],
)
def test_previous_period(period, expected):
    assert previous_period(period) == expected
