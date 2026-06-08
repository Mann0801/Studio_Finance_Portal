"""Batch definitions and fees. Single source of truth for pricing."""
from enum import Enum


class Batch(str, Enum):
    yoga = "yoga"
    zumba = "zumba"
    gymnastics = "gymnastics"


# Monthly fees in paise (Razorpay charges in the smallest currency unit).
BATCH_FEES_PAISE: dict[Batch, int] = {
    Batch.yoga: 2500_00,
    Batch.zumba: 2000_00,
    Batch.gymnastics: 3000_00,
}

BATCH_LABELS: dict[Batch, str] = {
    Batch.yoga: "Yoga",
    Batch.zumba: "Zumba",
    Batch.gymnastics: "Gymnastics",
}


def fee_paise(batch: Batch) -> int:
    return BATCH_FEES_PAISE[batch]
