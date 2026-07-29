"""Data access for the dynamic ``classes`` table — the studio's editable class
catalogue. The backend (service role) does all writes; the anon frontend reads
active classes for the signup page via RLS.

A class row shape:
  id, name, fee_type, fee_paise, sessions_per_month, schedule_days (int[]),
  slots (jsonb list of {key,name,start,end}), start_time, end_time, description,
  active, sort_order, created_at.
"""
from __future__ import annotations

import re
from typing import Optional

from .db import get_supabase


def list_classes(active_only: bool = False) -> list[dict]:
    q = get_supabase().table("classes").select("*").order("sort_order").order("name")
    if active_only:
        q = q.eq("active", True)
    return q.execute().data


def get_class(class_id: str) -> Optional[dict]:
    res = (
        get_supabase().table("classes").select("*").eq("id", class_id).limit(1).execute()
    )
    return res.data[0] if res.data else None


def class_map() -> dict[str, dict]:
    """All classes keyed by id (active + inactive) — for resolving student.batch."""
    return {c["id"]: c for c in list_classes()}


def student_count(class_id: str) -> int:
    res = (
        get_supabase()
        .table("students")
        .select("id", count="exact")
        .eq("batch", class_id)
        .execute()
    )
    return res.count or 0


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    return slug or "class"


def unique_slug(name: str) -> str:
    """A slug id that doesn't collide with an existing class id."""
    existing = {c["id"] for c in list_classes()}
    base = _slugify(name)
    if base not in existing:
        return base
    i = 2
    while f"{base}_{i}" in existing:
        i += 1
    return f"{base}_{i}"


def create_class(data: dict) -> dict:
    return get_supabase().table("classes").insert(data).execute().data[0]


def update_class(class_id: str, updates: dict) -> Optional[dict]:
    res = get_supabase().table("classes").update(updates).eq("id", class_id).execute()
    return res.data[0] if res.data else None


def soft_delete_class(class_id: str) -> None:
    """Mark a class inactive: it leaves signup but its row stays so existing
    students still resolve (shown as 'Batch Deleted' until reassigned)."""
    get_supabase().table("classes").update({"active": False}).eq("id", class_id).execute()


# ── Slot helpers ──────────────────────────────────────────────────────────────
def slot_by_key(cls: Optional[dict], slot_key: Optional[str]) -> Optional[dict]:
    if not cls or not slot_key:
        return None
    for s in cls.get("slots") or []:
        if s.get("key") == slot_key:
            return s
    return None


def slot_time(s: dict) -> str:
    start, end = s.get("start"), s.get("end")
    if start and end:
        return f"{start} – {end}"
    return start or end or ""


def slot_label_of(cls: Optional[dict], slot_key: Optional[str]) -> Optional[str]:
    """Human label (time range) for a class's timing slot, or None."""
    s = slot_by_key(cls, slot_key)
    return slot_time(s) if s else None


def class_label(cls: Optional[dict]) -> str:
    """Display name for a class, or a 'Batch Deleted' marker for a removed one."""
    if not cls or not cls.get("active", True):
        return cls["name"] if cls else "Batch Deleted"
    return cls["name"]
