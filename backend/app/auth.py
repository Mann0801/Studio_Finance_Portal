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

_bearer = HTTPBearer(auto_error=True)

ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12h


def _decode_student_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_current_student(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verify a Supabase student JWT; return ``{"id": ..., "email": ...}``.

    Email is read from the verified token (not client input) so it can't be
    spoofed at signup.
    """
    payload = _decode_student_jwt(creds.credentials)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"id": sub, "email": payload.get("email", "")}


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
