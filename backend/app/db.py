"""Supabase client (service role) — backend writes go through here.

Using the service-role key means these calls bypass Row-Level Security, so the
backend is the only thing that may set payment amounts/status. Never expose this
client or its key to the frontend.
"""
from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set; "
            "copy backend/.env.example to backend/.env and fill them in."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
