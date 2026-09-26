"""Data access for the ``enrollment_pauses`` table — a ledger of when a
student's enrollment in one class was frozen (no billing) and, once resumed,
when that freeze ended. An open row (``until_period`` is null) means the
enrollment is paused right now. Checked like ``payments.status == 'waived'``
but as a range rather than a single period, so past frozen months stay
protected from billing even after the student resumes."""
from __future__ import annotations

from typing import Optional

from .db import get_supabase
from .fees import current_period, previous_period


def get_open_pause(student_id: str, class_id: str) -> Optional[dict]:
    res = (
        get_supabase()
        .table("enrollment_pauses")
        .select("*")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .is_("until_period", "null")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def pause_enrollment(student_id: str, class_id: str, from_period: str | None = None) -> dict:
    """Freeze billing from `from_period` on (defaults to the current month —
    pass the NEXT month instead when the current one is already settled, so a
    pause never overwrites a month that's genuinely been paid)."""
    return (
        get_supabase()
        .table("enrollment_pauses")
        .insert(
            {
                "student_id": student_id,
                "class_id": class_id,
                "from_period": from_period or current_period(),
            }
        )
        .execute()
        .data[0]
    )


def resume_enrollment(student_id: str, class_id: str) -> None:
    """Close the open pause — billing resumes from the current period onward.
    Resuming in the same month it was paused means nothing was ever actually
    frozen, so the row is deleted rather than left as an inverted range."""
    row = get_open_pause(student_id, class_id)
    if not row:
        return
    until = previous_period(current_period())
    sb = get_supabase()
    if until < row["from_period"]:
        sb.table("enrollment_pauses").delete().eq("id", row["id"]).execute()
    else:
        sb.table("enrollment_pauses").update({"until_period": until}).eq("id", row["id"]).execute()


def pauses_for(student_id: str) -> list[dict]:
    """Every pause window (open or closed) for one student, across all their
    classes — for a student's own outstanding-months walk."""
    return (
        get_supabase()
        .table("enrollment_pauses")
        .select("*")
        .eq("student_id", student_id)
        .execute()
        .data
    )


def is_period_paused(rows: list[dict], class_id: str, period: str) -> bool:
    """Whether `period` falls inside any pause window recorded for this class,
    from a list of rows already fetched (e.g. via `pauses_for`)."""
    return any(
        r["class_id"] == class_id
        and r["from_period"] <= period
        and (r["until_period"] is None or period <= r["until_period"])
        for r in rows
    )


def paused_keys_for_period(period: str) -> set[tuple[str, str]]:
    """(student_id, class_id) pairs paused for `period`, across every student —
    one query for the admin's bulk rosters/month views."""
    rows = get_supabase().table("enrollment_pauses").select("*").execute().data
    return {
        (r["student_id"], r["class_id"])
        for r in rows
        if r["from_period"] <= period and (r["until_period"] is None or period <= r["until_period"])
    }
