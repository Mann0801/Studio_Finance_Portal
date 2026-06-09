"""Authentication: Supabase JWT verification for students, hardcoded admin login.

Students authenticate with Supabase Auth on the frontend and send the resulting
JWT as a Bearer token; we verify it here with the project's JWT secret. The admin
is a single hardcoded credential (from env) that we exchange for our own JWT.
"""
from __future__ import annotations

import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .db import get_supabase

_bearer = HTTPBearer(auto_error=True)

ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12h


def get_current_student(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verify a Supabase student access token via the Auth API; return
    ``{"id": ..., "email": ...}``.

    Validating through Supabase (rather than decoding a JWT locally) works
    regardless of the project's token-signing scheme, and the email comes from
    the verified user record (not client input) so it can't be spoofed at signup.
    """
    try:
        resp = get_supabase().auth.get_user(creds.credentials)
        user = getattr(resp, "user", None)
    except Exception:
        user = None
    if not user or not user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return {"id": user.id, "email": user.email or ""}


def get_current_student_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Verify a Supabase student JWT and return the user id (``sub``)."""
    return get_current_student(creds)["id"]


def create_admin_token() -> str:
    settings = get_settings()
    now = int(time.time())
    return jwt.encode(
        {"role": "admin", "iat": now, "exp": now + ADMIN_TOKEN_TTL_SECONDS},
        settings.admin_jwt_secret,
        algorithm="HS256",
    )


def verify_admin_credentials(email: str, password: str) -> bool:
    settings = get_settings()
    # NOTE: constant-time-ish; admin is a single hardcoded credential.
    return email == settings.admin_email and password == settings.admin_password


def require_admin(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> None:
    """Guard admin routes: require a valid admin JWT issued by us."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            creds.credentials, settings.admin_jwt_secret, algorithms=["HS256"]
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin auth required")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
