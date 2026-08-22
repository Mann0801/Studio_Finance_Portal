"""Data access for the ``enrollments`` table — the source of truth for which
classes a student is in. A student has one row per class they've joined, each
with its own timing slot, join date (pro-rata is per class) and WhatsApp-joined
flag. ``students.batch/batch_slot/join_date/whatsapp_joined`` are kept as a
mirror of the student's first/primary enrollment for legacy reads."""
from __future__ import annotations

from typing import Optional

from .db import get_supabase


def list_enrollments(student_id: str) -> list[dict]:
    return (
        get_supabase()
        .table("enrollments")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at")
        .execute()
        .data
    )


def get_enrollment(student_id: str, class_id: str) -> Optional[dict]:
    res = (
        get_supabase()
        .table("enrollments")
        .select("*")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_enrollment(
    student_id: str, class_id: str, batch_slot: Optional[str], join_date: str
) -> dict:
    return (
        get_supabase()
        .table("enrollments")
        .insert(
            {
                "student_id": student_id,
                "class_id": class_id,
                "batch_slot": batch_slot,
                "join_date": join_date,
            }
        )
        .execute()
        .data[0]
    )


def update_enrollment(student_id: str, class_id: str, updates: dict) -> Optional[dict]:
    res = (
        get_supabase()
        .table("enrollments")
        .update(updates)
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete_enrollment(student_id: str, class_id: str) -> None:
    (
        get_supabase()
        .table("enrollments")
        .delete()
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .execute()
    )


def set_whatsapp_joined(student_id: str, class_id: str) -> Optional[dict]:
    return update_enrollment(student_id, class_id, {"whatsapp_joined": True})


def all_enrollments() -> list[dict]:
    """Every enrollment across all students — for admin stats/rosters."""
    return get_supabase().table("enrollments").select("*").execute().data


def student_counts() -> dict[str, int]:
    """Enrollment count per class in a single query (avoids an N+1 of one count
    round-trip per class when rendering the admin Classes list)."""
    rows = get_supabase().table("enrollments").select("class_id").execute().data
    counts: dict[str, int] = {}
    for r in rows:
        cid = r.get("class_id")
        if cid:
            counts[cid] = counts.get(cid, 0) + 1
    return counts


def student_count(class_id: str) -> int:
    res = (
        get_supabase()
        .table("enrollments")
        .select("id", count="exact")
        .eq("class_id", class_id)
        .execute()
    )
    return res.count or 0
