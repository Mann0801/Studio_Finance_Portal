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


# Students log in with phone + password. Supabase auth is email-based, so the
# phone maps to a synthetic internal email (never shown). MUST match the frontend
# (lib/auth.js phoneToEmail): the last 10 digits @ this domain.
PHONE_LOGIN_DOMAIN = "phone.iampossiblefit.com"


def phone_login_email(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")[-10:]
    return f"{digits}@{PHONE_LOGIN_DOMAIN}"
