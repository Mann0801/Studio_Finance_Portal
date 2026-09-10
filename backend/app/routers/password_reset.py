"""Self-serve "forgot password" for students — phone number in, a 6-digit
code emailed to their recovery address, code + new password back in via
Supabase's own verifyOtp() on the frontend. Entirely public/unauthenticated —
a student who forgot their password can't authenticate yet, that's the point.

The code itself is generated + verified by Supabase (not tracked here); this
endpoint's only job is looking up the right account and delivering the code
by email, since Supabase's own mailer would send it to the account's
synthetic phone-based login address instead of the student's real inbox.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import get_supabase
from ..schemas import ForgotPasswordRequest, ForgotPasswordResponse
from ..services.email_service import send_email
from ..util import normalize_phone, phone_login_email

router = APIRouter(prefix="/api/password-reset", tags=["password-reset"])

_SUBJECT = "Your password reset code"


def _body(code: str) -> str:
    return (
        f"Your password reset code is: {code}\n\n"
        "Enter this in the app to set a new password. It expires shortly, "
        "so use it soon.\n\n"
        "If you didn't request this, you can safely ignore this email."
    )


@router.post("/request", response_model=ForgotPasswordResponse)
def request_reset(body: ForgotPasswordRequest):
    """Look up the student by phone and, if they have a recovery email on
    file, email them a reset code. Gives an honest, specific reason when it
    can't — not registered, or no recovery email yet — rather than a vague
    "check your email" that would leave them waiting on nothing."""
    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    sb = get_supabase()
    res = sb.table("students").select("id, phone, email").eq("phone", phone).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="No account found with that phone number")

    student = res.data[0]
    if not student.get("email"):
        raise HTTPException(
            status_code=400,
            detail="No recovery email on file for this account — please contact the studio to reset your password",
        )

    login_email = phone_login_email(phone)
    link = sb.auth.admin.generate_link({"type": "recovery", "email": login_email})
    code = link.properties.email_otp

    send_email(student["email"], _SUBJECT, _body(code))
    return ForgotPasswordResponse(sent=True, message=f"We've sent a code to {student['email']}")
