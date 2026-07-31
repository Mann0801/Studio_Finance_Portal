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
from .constants import ENQUIRY, MONTHLY, PER_SESSION, SESSION_PACK


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


def period_label(period: str) -> str:
    """'2026-06' -> 'June 2026' for human-facing messages."""
    year, month = parse_period(period)
    return f"{calendar.month_name[month]} {year}"


def parse_period(period: str) -> tuple[int, int]:
    year_s, month_s = period.split("-")
    year, month = int(year_s), int(month_s)
    if not (1 <= month <= 12):
        raise ValueError(f"invalid period: {period!r}")
    return year, month


def days_in_month(period: str) -> int:
    year, month = parse_period(period)
    return calendar.monthrange(year, month)[1]


def previous_period(period: str) -> str:
    """The calendar month before ``period`` as ``YYYY-MM``."""
    year, month = parse_period(period)
    if month == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{month - 1:02d}"


def month_range(period: str) -> tuple[str, str]:
    """(first day, first day of next month) as ISO date strings — for [start, end)
    range queries over a calendar month."""
    year, month = parse_period(period)
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start.isoformat(), end.isoformat()


def _round_to_rupee_paise(paise: Decimal) -> int:
    """Round a paise amount to the nearest whole rupee, returned as paise."""
    rupees = (paise / Decimal(100)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(rupees) * 100


def _count_session_days(
    year: int, month: int, weekdays: tuple[int, ...], from_day: int = 1
) -> int:
    """How many days in ``[from_day, end of month]`` fall on the given weekdays."""
    last = calendar.monthrange(year, month)[1]
    return sum(
        1
        for day in range(from_day, last + 1)
        if date(year, month, day).weekday() in weekdays
    )


@dataclass(frozen=True)
class DueAmount:
    period: str
    amount_paise: int
    is_prorata: bool


def _zero(period: str) -> DueAmount:
    return DueAmount(period=period, amount_paise=0, is_prorata=False)


def compute_due(cls: dict | None, join_date: date, period: str) -> DueAmount:
    """How much a student in class ``cls`` owes for ``period``.

    ``cls`` is a row from the ``classes`` table (or None for a deleted class).
    Returns 0 for a deleted/enquiry class or a period before the join month. The
    join month is pro-rata; later months are the full fee.

      * MONTHLY      — pro-rata by days.
      * SESSION_PACK — full = pack price; join month = pack/N × remaining class
                       days (capped at N).
      * PER_SESSION  — per-session price × scheduled class days in the period.
      * ENQUIRY      — nothing to pay online.
    """
    if not cls:
        return _zero(period)
    fee_type = cls.get("fee_type")
    if fee_type == ENQUIRY:
        return _zero(period)

    join_period = period_of(join_date)
    if period < join_period:
        return _zero(period)

    year, month = parse_period(period)
    is_join_month = period == join_period
    fee = cls.get("fee_paise") or 0
    weekdays = tuple(cls.get("schedule_days") or ())

    if fee_type == MONTHLY:
        if is_join_month:
            total_days = days_in_month(period)
            days_remaining = total_days - join_date.day + 1  # inclusive of join day
            prorata = Decimal(fee) * Decimal(days_remaining) / Decimal(total_days)
            amount = _round_to_rupee_paise(prorata)
            # Joining on the 1st (or a day that rounds up to the whole fee) is a
            # full month, not a pro-rated one — don't mislabel it.
            return DueAmount(period, amount, amount < fee)
        return DueAmount(period, fee, False)

    if fee_type == SESSION_PACK:
        spm = cls.get("sessions_per_month") or 0
        if is_join_month and spm > 0:
            remaining = min(
                _count_session_days(year, month, weekdays, from_day=join_date.day), spm
            )
            per_session = Decimal(fee) / Decimal(spm)
            return DueAmount(
                period, _round_to_rupee_paise(per_session * Decimal(remaining)), True
            )
        return DueAmount(period, fee, False)

    if fee_type == PER_SESSION:
        if is_join_month:
            sessions = _count_session_days(year, month, weekdays, from_day=join_date.day)
            return DueAmount(period, fee * sessions, True)
        sessions = _count_session_days(year, month, weekdays)
        return DueAmount(period, fee * sessions, False)

    return _zero(period)  # unknown fee type
