"""Small shared helpers."""
from __future__ import annotations

import re


def normalize_phone(raw: str, default_country_code: str = "91") -> str:
    """Normalize a phone number to digits-with-country-code (for wa.me links).

    Strips spaces, dashes, parens and a leading ``+``. A bare 10-digit number is
    assumed to be Indian and prefixed with the country code. Raises ValueError if
    the result doesn't look like a plausible phone number.
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = default_country_code + digits
    if not (11 <= len(digits) <= 15):
        raise ValueError("invalid phone number")
    return digits
