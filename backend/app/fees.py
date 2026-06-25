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
from .constants import SESSION, Batch, batch_info


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


def classes_in_month(batch: Batch, period: str) -> int:
    """Number of scheduled classes for ``batch`` in ``period``. Session batches
    use their package size / matching weekend days; monthly batches meet Mon–Fri."""
    info = batch_info(batch)
    year, month = parse_period(period)
    if info.billing == SESSION:
        return info.sessions_per_month or _count_session_days(
            year, month, info.session_weekdays
        )
    return _count_session_days(year, month, (0, 1, 2, 3, 4))


@dataclass(frozen=True)
class DueAmount:
    period: str
    amount_paise: int
    is_prorata: bool


def compute_due(batch: Batch, join_date: date, period: str) -> DueAmount:
    """How much a student in ``batch`` owes for ``period``.

    Returns 0 for periods before the join month. The join month is pro-rata —
    by days (monthly batches) or by sessions remaining (session batches). All
    later months are the full fee for that month.
    """
    info = batch_info(batch)
    join_period = period_of(join_date)

    if period < join_period:
        return DueAmount(period=period, amount_paise=0, is_prorata=False)

    year, month = parse_period(period)
    is_join_month = period == join_period

    if info.billing == SESSION:
        # total_sessions = the monthly package size (cap) or every matching day.
        total_sessions = info.sessions_per_month or _count_session_days(
            year, month, info.session_weekdays
        )
        if is_join_month:
            remaining = _count_session_days(
                year, month, info.session_weekdays, from_day=join_date.day
            )
            if info.sessions_per_month is not None:
                remaining = min(remaining, info.sessions_per_month)
            # Per-session prices are whole rupees, so no rounding is needed.
            return DueAmount(
                period=period,
                amount_paise=info.unit_paise * remaining,
                is_prorata=True,
            )
        return DueAmount(
            period=period,
            amount_paise=info.unit_paise * total_sessions,
            is_prorata=False,
        )

    # Monthly billing.
    full = info.unit_paise
    if is_join_month:
        total_days = days_in_month(period)
        days_remaining = total_days - join_date.day + 1  # inclusive of join day
        prorata = Decimal(full) * Decimal(days_remaining) / Decimal(total_days)
        return DueAmount(
            period=period,
            amount_paise=_round_to_rupee_paise(prorata),
            is_prorata=True,
        )

    return DueAmount(period=period, amount_paise=full, is_prorata=False)
