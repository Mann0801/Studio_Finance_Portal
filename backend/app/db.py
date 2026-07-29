"""Supabase client (service role) — backend writes go through here.

Using the service-role key means these calls bypass Row-Level Security, so the
backend is the only thing that may set payment amounts/status. Never expose this
client or its key to the frontend.
"""
import logging
from functools import lru_cache

import httpx
from supabase import Client, create_client

from .config import get_settings

# Errors that mean the request never reached the server (or it dropped the
# connection without responding) — safe to retry once on a fresh connection.
# These happen when a pooled keep-alive connection to Supabase goes stale after
# the backend sits idle, and the next call reuses the now-dead socket.
_RETRIABLE = (httpx.RemoteProtocolError, httpx.ConnectError, httpx.PoolTimeout)


def _install_retry(session: httpx.Client) -> None:
    """Wrap an httpx client's send() so a stale-connection failure retries once.
    httpcore discards the dead connection on the first error, so the retry opens
    a fresh one and succeeds — instead of surfacing a 500 to the user."""
    original_send = session.send

    def send_with_retry(request, **kwargs):
        try:
            return original_send(request, **kwargs)
        except _RETRIABLE:
            logging.getLogger("uvicorn.error").warning(
                "Supabase connection dropped on %s %s — retrying once",
                request.method,
                request.url.path,
            )
            return original_send(request, **kwargs)

    session.send = send_with_retry


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set; "
            "copy backend/.env.example to backend/.env and fill them in."
        )
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    # Guard the REST (postgrest) session — that's where .table() queries go and
    # where the stale-connection 500s were observed. Best-effort; never let a
    # library-shape change break client creation.
    try:
        _install_retry(client.postgrest.session)
    except Exception:  # noqa: BLE001 — retry is an enhancement, not a requirement
        logging.getLogger("uvicorn.error").exception("Could not install DB retry wrapper")
    return client
