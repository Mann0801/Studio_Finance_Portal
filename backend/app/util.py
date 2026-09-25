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


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(raw: str) -> str:
    """Lowercase + loosely validate a recovery email. Raises ValueError if it
    doesn't look like a plausible address."""
    email = (raw or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise ValueError("invalid email address")
    return email


# Students log in with phone + password. Supabase auth is email-based, so the
# phone maps to a synthetic internal email (never shown). MUST match the frontend
# (lib/auth.js phoneToEmail): the last 10 digits @ this domain.
PHONE_LOGIN_DOMAIN = "phone.iampossiblefit.com"


def phone_login_email(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")[-10:]
    return f"{digits}@{PHONE_LOGIN_DOMAIN}"


class PhoneLoginConflict(Exception):
    """Raised when another account is already registered with the phone
    number being switched to (its derived login email is already taken)."""


def sync_login_email_for_phone_change(sb, user_id: str, old_phone: str, new_phone: str) -> None:
    """If a student/admin is changing a student's phone number, move the
    account's real Supabase Auth login email (derived from phone) to match.

    Without this, changing ``students.phone`` only updates the DISPLAYED
    number — login always re-derives the auth email from whatever phone is
    typed at the login screen, so the account would silently stay reachable
    only via the OLD number forever. A no-op when the phone isn't actually
    changing.

    Raises ``PhoneLoginConflict`` if another account already has that phone.
    Checked against our own ``students`` table rather than by inspecting the
    Supabase Auth API's error on a rejected update — verified live that a
    duplicate-email rejection there comes back as a generic
    ``AuthApiError("Error updating user")`` with no distinguishing code, so
    a message-based check can't reliably tell a conflict apart from any
    other failure.
    """
    if new_phone == old_phone:
        return
    conflict = (
        sb.table("students").select("id").eq("phone", new_phone).neq("id", user_id).limit(1).execute()
    )
    if conflict.data:
        raise PhoneLoginConflict
    new_login_email = phone_login_email(new_phone)
    sb.auth.admin.update_user_by_id(user_id, {"email": new_login_email})
