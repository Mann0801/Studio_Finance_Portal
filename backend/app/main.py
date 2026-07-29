"""FastAPI entrypoint: app setup, CORS, router mounting, health check."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings

settings = get_settings()

app = FastAPI(title="Studio Finance API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
