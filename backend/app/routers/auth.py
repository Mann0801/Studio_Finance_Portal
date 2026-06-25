"""Public auth helpers for the username + password flow.

OTP (email/phone) verification and password storage happen on the frontend via
Supabase Auth. These endpoints cover the two things Supabase can't do natively:
  - check whether a username is free (profile setup),
  - sign in by *username* + password (Supabase only knows email/phone), by
    resolving the username to its identity and running the password grant with
    the public anon key, then handing the session tokens back to the client.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from supabase import create_client

from ..config import get_settings
from ..db import get_supabase
from ..schemas import LoginRequest, SessionResponse, UsernameAvailability

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


def _find_by_username(username: str) -> dict | None:
    # ilike with no wildcards = case-insensitive exact match.
    res = get_supabase().table("students").select("*").ilike("username", username).execute()
    return res.data[0] if res.data else None


@router.get("/username-available", response_model=UsernameAvailability)
def username_available(username: str):
    u = (username or "").strip()
    if not USERNAME_RE.match(u):
        return UsernameAvailability(
            available=False, reason="3–30 letters, numbers or underscores"
        )
    if _find_by_username(u):
        return UsernameAvailability(available=False, reason="Already taken")
    return UsernameAvailability(available=True)


@router.post("/login", response_model=SessionResponse)
def login(body: LoginRequest):
    """Exchange username + password for a Supabase session (access + refresh
    tokens). Always returns a generic error so usernames can't be enumerated."""
    settings = get_settings()
    if not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="Login is not configured")

    student = _find_by_username(body.username.strip())
    # Phone-only accounts sign in by phone; email accounts by email.
    identity = None
    if student:
        if student.get("email"):
            identity = {"email": student["email"], "password": body.password}
        elif student.get("phone"):
            identity = {"phone": student["phone"], "password": body.password}

    if not identity:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    anon = create_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        res = anon.auth.sign_in_with_password(identity)
        session = getattr(res, "session", None)
    except Exception:
        session = None

    if not session:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return SessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )
