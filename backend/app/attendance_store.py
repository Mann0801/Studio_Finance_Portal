"""Data access for the ``attendance`` table — student self-reported "I
attended this session today" for PER_SESSION classes. This is the source of
truth ``fees.compute_due`` uses to bill PER_SESSION classes, instead of
assuming every scheduled class day was actually held. One row per
(student, class, calendar day); marking twice the same day is a no-op."""
from __future__ import annotations

from .db import get_supabase
from .fees import month_range, now_local


def today_local() -> str:
    return now_local().date().isoformat()


def mark_today(student_id: str, class_id: str, marked_by: str = "student") -> dict:
    """Record today's session as attended. Idempotent — marking twice the same
    day returns the existing row rather than erroring."""
    today = today_local()
    sb = get_supabase()
    existing = (
        sb.table("attendance")
        .select("*")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .eq("session_date", today)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]
    return (
        sb.table("attendance")
        .insert(
            {
                "student_id": student_id,
                "class_id": class_id,
                "session_date": today,
                "marked_by": marked_by,
            }
        )
        .execute()
        .data[0]
    )


def marked_today(student_id: str, class_id: str) -> bool:
    res = (
        get_supabase()
        .table("attendance")
        .select("id")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .eq("session_date", today_local())
        .limit(1)
        .execute()
    )
    return bool(res.data)


def count_for_period(student_id: str, class_id: str, period: str) -> int:
    """How many sessions this student has marked attended for `class_id` in
    `period` — the number PER_SESSION billing multiplies by the per-session
    price. Used for single-student contexts (dashboard, mark-paid, etc.)."""
    start, end = month_range(period)
    res = (
        get_supabase()
        .table("attendance")
        .select("id", count="exact")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .gte("session_date", start)
        .lt("session_date", end)
        .execute()
    )
    return res.count or 0


def counts_for_period(period: str, class_id: str | None = None) -> dict[tuple[str, str], int]:
    """Bulk ``{(student_id, class_id): count}`` for every attendance row in
    `period` — one query for admin rosters/stats instead of a query per
    student."""
    start, end = month_range(period)
    sb = get_supabase()
    q = (
        sb.table("attendance")
        .select("student_id,class_id")
        .gte("session_date", start)
        .lt("session_date", end)
    )
    if class_id:
        q = q.eq("class_id", class_id)
    counts: dict[tuple[str, str], int] = {}
    for row in q.execute().data or []:
        key = (row["student_id"], row["class_id"])
        counts[key] = counts.get(key, 0) + 1
    return counts


def list_for_class(class_id: str, period: str | None = None) -> list[dict]:
    """Every attendance row for one class, most recent first — the admin
    review/undo list. Scoped to `period` when given."""
    q = get_supabase().table("attendance").select("*").eq("class_id", class_id)
    if period:
        start, end = month_range(period)
        q = q.gte("session_date", start).lt("session_date", end)
    return q.order("session_date", desc=True).execute().data or []


def delete_attendance(attendance_id: str) -> None:
    get_supabase().table("attendance").delete().eq("id", attendance_id).execute()
