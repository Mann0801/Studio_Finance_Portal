"""Fee computation — pure, server-side source of truth for payment amounts.

All month math is on calendar months in the configured timezone (IST by default).
The first calendar month a student is enrolled is pro-rata:

    amount = round_to_rupee(monthly_fee * days_remaining / days_in_month)

where ``days_remaining`` is inclusive of the join day. Every later month is the
full fee. Periods are strings of the form ``"YYYY-MM"``.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from .config import get_settings
from .constants import Batch, fee_paise


def _tz() -> ZoneInfo:
    return ZoneInfo(get_settings().timezone)


def now_local() -> datetime:
    """Current wall-clock time in the configured timezone."""
    return datetime.now(_tz())


def current_period() -> str:
    """The current calendar month as ``YYYY-MM`` in the configured timezone."""
    return now_local().strftime("%Y-%m")


def period_of(d: date) -> str:
    return d.strftime("%Y-%m")


def parse_period(period: str) -> tuple[int, int]:
    year_s, month_s = period.split("-")
    year, month = int(year_s), int(month_s)
    if not (1 <= month <= 12):
        raise ValueError(f"invalid period: {period!r}")
    return year, month


def days_in_month(period: str) -> int:
    year, month = parse_period(period)
    return calendar.monthrange(year, month)[1]


def _round_to_rupee_paise(paise: Decimal) -> int:
    """Round a paise amount to the nearest whole rupee, returned as paise."""
    rupees = (paise / Decimal(100)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(rupees) * 100


@dataclass(frozen=True)
class DueAmount:
    period: str
    amount_paise: int
    is_prorata: bool


def compute_due(batch: Batch, join_date: date, period: str) -> DueAmount:
    """How much a student in ``batch`` owes for ``period``.

    Returns 0 for periods before the join month. The join month is pro-rata;
    all later months are the full fee.
    """
    full = fee_paise(batch)
    join_period = period_of(join_date)

    if period < join_period:
        return DueAmount(period=period, amount_paise=0, is_prorata=False)

    if period == join_period:
        total_days = days_in_month(period)
        days_remaining = total_days - join_date.day + 1  # inclusive of join day
        prorata = Decimal(full) * Decimal(days_remaining) / Decimal(total_days)
        return DueAmount(
            period=period,
            amount_paise=_round_to_rupee_paise(prorata),
            is_prorata=True,
        )

    return DueAmount(period=period, amount_paise=full, is_prorata=False)
