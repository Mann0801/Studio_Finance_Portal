"""FastAPI entrypoint: app setup, CORS, router mounting, health check."""
import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings

settings = get_settings()

# Error monitoring. Only active when SENTRY_DSN is set (so local dev stays quiet).
# send_default_pii=False keeps request bodies/headers/IPs out of Sentry — no
# passwords, tokens or student PII leave the server; we still get the exception
# + stack trace + endpoint, which is what's needed to debug.
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        send_default_pii=False,
        traces_sample_rate=0.0,  # errors only, no performance tracing
    )

app = FastAPI(title="Studio Finance API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# TEMP: triggers a crash on purpose so we can confirm Sentry captures it. Remove
# after verifying it shows up in the Sentry dashboard.
@app.get("/api/debug/sentry-check", include_in_schema=False)
def _sentry_check():
    raise RuntimeError("Sentry test error — safe to ignore")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Report any unhandled crash to Sentry and return a clean JSON 500 (which
    still gets CORS headers), so the browser shows a real message instead of the
    cryptic 'failed to fetch'. Intentional HTTPExceptions are unaffected."""
    sentry_sdk.capture_exception(exc)
    logging.getLogger("uvicorn.error").exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again in a moment."},
    )


# GET + HEAD so lightweight uptime monitors (which ping with HEAD by default)
# don't get a 405. Used as the keep-warm target to stop the free tier sleeping.
@app.api_route("/health", methods=["GET", "HEAD"], tags=["meta"])
def health() -> dict:
    return {"status": "ok", "studio": settings.studio_name}


from .routers import (  # noqa: E402
    admin,
    announcements,
    classes,
    payments,
    students,
    webhooks,
)

app.include_router(students.router)
app.include_router(payments.router)
app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(announcements.router)
app.include_router(classes.router)
