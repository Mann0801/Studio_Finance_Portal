"""Batch definitions and fees. Single source of truth for pricing.

Two billing models:
  * MONTHLY — a flat monthly fee; the join month is pro-rata by days.
  * SESSION — a per-session price; the join month is pro-rata by the number of
    class days (specific weekdays) remaining, optionally capped per month.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

MONTHLY = "monthly"
SESSION = "session"


class Batch(str, Enum):
    senior_citizens_yoga = "senior_citizens_yoga"
    traditional_yoga = "traditional_yoga"
    weight_loss_yoga = "weight_loss_yoga"
    prenatal_yoga = "prenatal_yoga"
    gymnastics = "gymnastics"
    zumba = "zumba"
    kids_yoga = "kids_yoga"
    test_course = "test_course"  # TEMP: ₹10 flat, for verifying live payments end-to-end


@dataclass(frozen=True)
class BatchInfo:
    label: str
    schedule: str
    billing: str
    # MONTHLY: the full monthly fee in paise.
    # SESSION: the price of a single session in paise.
    unit_paise: int
    session_weekdays: tuple[int, ...] = ()   # 0=Mon … 6=Sun (SESSION only)
    sessions_per_month: int | None = None    # cap on billable sessions (SESSION); None = every matching day
    has_slots: bool = False                  # requires a timing slot (Traditional Yoga)


BATCHES_INFO: dict[Batch, BatchInfo] = {
    Batch.senior_citizens_yoga: BatchInfo(
        "Senior Citizens Yoga", "Mon to Fri · 5:45–6:30 AM", MONTHLY, 2000_00
    ),
    Batch.traditional_yoga: BatchInfo(
        "Traditional Yoga", "Mon to Fri", MONTHLY, 2300_00, has_slots=True
    ),
    Batch.weight_loss_yoga: BatchInfo(
        "Weight Loss Yoga", "Mon to Fri · 6:00–7:00 PM", MONTHLY, 3000_00
    ),
    Batch.prenatal_yoga: BatchInfo(
        "Prenatal Yoga", "Sat & Sun", SESSION, 1000_00, session_weekdays=(5, 6)
    ),
    Batch.gymnastics: BatchInfo(
        "Gymnastics", "Tue & Sun · 8 classes/month", SESSION, 350_00,
        session_weekdays=(1, 6), sessions_per_month=8,
    ),
    Batch.zumba: BatchInfo(
        "Zumba", "Sat & Sun · 8 classes/month", SESSION, 250_00,
        session_weekdays=(5, 6), sessions_per_month=8,
    ),
    Batch.kids_yoga: BatchInfo("Kids Yoga", "", MONTHLY, 2000_00),
    # TEMP test course: SESSION billing with a 1-session cap and every weekday as a
    # session day → always exactly ₹10, no pro-rata. Remove after payment testing.
    Batch.test_course: BatchInfo(
        "Test Course", "Test only — verifies live payments", SESSION, 10_00,
        session_weekdays=(0, 1, 2, 3, 4, 5, 6), sessions_per_month=1,
    ),
}

# Traditional Yoga timing slots (stored on students.batch_slot).
TRADITIONAL_SLOTS: dict[str, str] = {
    "batch1": "6:30 AM – 7:30 AM",
    "batch2": "7:30 AM – 8:30 AM",
    "batch3": "8:30 AM – 9:30 AM",
    "batch4": "5:00 PM – 6:00 PM",
}

BATCH_LABELS: dict[Batch, str] = {b: info.label for b, info in BATCHES_INFO.items()}


def batch_info(batch: Batch) -> BatchInfo:
    return BATCHES_INFO[batch]


def slot_label(slot: str | None) -> str | None:
    """Human label for a Traditional Yoga slot key, or None."""
    if not slot:
        return None
    return TRADITIONAL_SLOTS.get(slot)
