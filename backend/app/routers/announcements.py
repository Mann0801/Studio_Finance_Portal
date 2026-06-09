"""Announcement banner routes.

Students read the current active banner; the admin posts / updates / clears it.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from ..announcements_store import (
    clear_active,
    get_active,
    post_announcement,
    update_active,
)
from ..auth import get_current_student, require_admin
from ..schemas import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix="/api", tags=["announcements"])


def _out(row: Optional[dict]) -> Optional[AnnouncementOut]:
    if not row:
        return None
    return AnnouncementOut(id=row["id"], message=row["message"], created_at=row["created_at"])


@router.get("/announcement", response_model=Optional[AnnouncementOut])
def current_announcement(_student=Depends(get_current_student)):
    """The active banner for the logged-in student (or null if none)."""
    return _out(get_active())


@router.get(
    "/admin/announcement",
    response_model=Optional[AnnouncementOut],
    dependencies=[Depends(require_admin)],
)
def admin_get_announcement():
    return _out(get_active())


@router.post(
    "/admin/announcement",
    response_model=AnnouncementOut,
    dependencies=[Depends(require_admin)],
)
def admin_post_announcement(body: AnnouncementIn):
    return _out(post_announcement(body.message.strip()))


@router.put(
    "/admin/announcement",
    response_model=AnnouncementOut,
    dependencies=[Depends(require_admin)],
)
def admin_update_announcement(body: AnnouncementIn):
    return _out(update_active(body.message.strip()))


@router.delete("/admin/announcement", dependencies=[Depends(require_admin)])
def admin_delete_announcement():
    clear_active()
    return {"status": "cleared"}
