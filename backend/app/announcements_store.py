"""Database operations for the announcement banner.

There is conceptually a single active announcement at a time: posting a new one
deactivates the previous, and deleting deactivates whatever is active. We keep old
rows (soft delete via ``active``) rather than hard-deleting, for history.
"""
from __future__ import annotations

from typing import Optional

from .db import get_supabase
from .fees import now_local


def get_active() -> Optional[dict]:
    res = (
        get_supabase()
        .table("announcements")
        .select("*")
        .eq("active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def list_announcements(limit: int = 50) -> list[dict]:
    """All announcements (current + past), newest first — powers the student
    Announcements page."""
    return (
        get_supabase()
        .table("announcements")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data


def post_announcement(message: str) -> dict:
    """Deactivate any existing active announcement, then insert a new active one."""
    sb = get_supabase()
    sb.table("announcements").update({"active": False}).eq("active", True).execute()
    inserted = sb.table("announcements").insert({"message": message, "active": True}).execute()
    return inserted.data[0]


def get_announcement(ann_id: str) -> Optional[dict]:
    res = get_supabase().table("announcements").select("*").eq("id", ann_id).limit(1).execute()
    return res.data[0] if res.data else None


def update_announcement(ann_id: str, message: str) -> Optional[dict]:
    """Edit the text of any announcement (active or past)."""
    res = (
        get_supabase()
        .table("announcements")
        .update({"message": message, "updated_at": now_local().isoformat()})
        .eq("id", ann_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete_announcement(ann_id: str) -> None:
    """Permanently remove a specific announcement."""
    get_supabase().table("announcements").delete().eq("id", ann_id).execute()


def activate_announcement(ann_id: str) -> Optional[dict]:
    """Make a specific (e.g. older) announcement the live banner again."""
    sb = get_supabase()
    sb.table("announcements").update({"active": False}).eq("active", True).execute()
    res = sb.table("announcements").update({"active": True}).eq("id", ann_id).execute()
    return res.data[0] if res.data else None


def update_active(message: str) -> Optional[dict]:
    """Update the text of the active announcement; create one if none is active."""
    sb = get_supabase()
    active = get_active()
    if not active:
        return post_announcement(message)
    updated = (
        sb.table("announcements")
        .update({"message": message, "updated_at": now_local().isoformat()})
        .eq("id", active["id"])
        .execute()
    )
    return updated.data[0] if updated.data else None


def clear_active() -> None:
    get_supabase().table("announcements").update({"active": False}).eq("active", True).execute()
