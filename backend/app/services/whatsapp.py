"""Build wa.me reminder links (no API — just a prefilled WhatsApp message)."""
from __future__ import annotations

from urllib.parse import quote

from ..config import get_settings
from ..fees import period_label


def reminder_message(name: str, batch_label: str, amount_rupees: int, period: str) -> str:
    settings = get_settings()
    return (
        f"Hi {name}, this is a reminder that your {batch_label} fee of "
        f"₹{amount_rupees:,} for {period_label(period)} is pending. "
        f"Pay here: {settings.student_portal_url}"
    )


def reminder_link(
    phone: str, name: str, batch_label: str, amount_paise: int, period: str
) -> str:
    """A click-to-chat wa.me link with a prefilled fee-reminder message."""
    msg = reminder_message(name, batch_label, amount_paise // 100, period)
    return f"https://wa.me/{phone}?text={quote(msg)}"
