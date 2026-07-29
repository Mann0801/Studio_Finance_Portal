"""Announcement routes.

Students read the current active banner + the full history; the admin manages
all announcements (create / edit / delete / set-as-banner).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..announcements_store import (
    activate_announcement,
    delete_announcement,
    get_active,
    list_announcements,
    post_announcement,
    update_announcement,
)
from ..auth import get_current_student, require_admin
from ..schemas import AdminAnnouncementRow, AnnouncementIn, AnnouncementOut

router = APIRouter(prefix="/api", tags=["announcements"])


def _out(row: Optional[dict]) -> Optional[AnnouncementOut]:
    if not row:
        return None
    return AnnouncementOut(id=row["id"], message=row["message"], created_at=row["created_at"])


def _admin_out(row: dict) -> AdminAnnouncementRow:
    return AdminAnnouncementRow(
        id=row["id"],
        message=row["message"],
        created_at=row["created_at"],
        active=bool(row.get("active")),
    )


# ── Student ──
@router.get("/announcement", response_model=Optional[AnnouncementOut])
def current_announcement(_student=Depends(get_current_student)):
    """The active banner for the logged-in student (or null if none)."""
    return _out(get_active())


@router.get("/announcements", response_model=list[AnnouncementOut])
def all_announcements(_student=Depends(get_current_student)):
    """All announcements (current + past), newest first."""
    return [_out(r) for r in list_announcements()]


# ── Admin management ──
@router.get(
    "/admin/announcements",
    response_model=list[AdminAnnouncementRow],
    dependencies=[Depends(require_admin)],
)
def admin_list_announcements():
    return [_admin_out(r) for r in list_announcements()]


@router.post(
    "/admin/announcements",
    response_model=AdminAnnouncementRow,
    dependencies=[Depends(require_admin)],
)
def admin_create_announcement(body: AnnouncementIn):
    """Post a new announcement — it becomes the live student banner."""
    return _admin_out(post_announcement(body.message.strip()))


@router.patch(
    "/admin/announcements/{ann_id}",
    response_model=AdminAnnouncementRow,
    dependencies=[Depends(require_admin)],
)
def admin_edit_announcement(ann_id: str, body: AnnouncementIn):
    updated = update_announcement(ann_id, body.message.strip())
    if not updated:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return _admin_out(updated)


@router.delete("/admin/announcements/{ann_id}", dependencies=[Depends(require_admin)])
def admin_delete_announcement(ann_id: str):
    delete_announcement(ann_id)
    return {"status": "deleted"}


@router.post(
    "/admin/announcements/{ann_id}/activate",
    response_model=AdminAnnouncementRow,
    dependencies=[Depends(require_admin)],
)
def admin_activate_announcement(ann_id: str):
    """Make an older announcement the live banner again."""
    activated = activate_announcement(ann_id)
    if not activated:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return _admin_out(activated)
