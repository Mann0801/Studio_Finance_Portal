"""Student-facing routes: signup (profile + batch) and read-only dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_student
from ..constants import BATCH_LABELS, Batch
from ..db import get_supabase
from ..fees import compute_due, current_period, month_range, now_local
from ..schemas import (
    CurrentDue,
    DashboardOut,
    PaymentOut,
    SignupRequest,
    StudentOut,
)
from ..util import normalize_phone

router = APIRouter(prefix="/api", tags=["students"])


def _student_out(row: dict) -> StudentOut:
    batch = Batch(row["batch"])
    return StudentOut(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        phone=row["phone"],
        batch=batch,
        batch_label=BATCH_LABELS[batch],
        join_date=row["join_date"],
    )


@router.post("/signup", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, student=Depends(get_current_student)):
    """Attach profile + chosen batch to the authenticated Supabase user.

    The account itself (email/password) is created on the frontend via Supabase
    Auth; here we only create the matching ``students`` row, keyed to the verified
    user id. Idempotent: returns the existing profile if already registered.
    """
    sb = get_supabase()
    existing = sb.table("students").select("*").eq("id", student["id"]).execute()
    if existing.data:
        return _student_out(existing.data[0])

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    row = {
        "id": student["id"],
        "name": body.name.strip(),
        "email": student["email"],
        "phone": phone,
        "batch": body.batch.value,
        "join_date": now_local().date().isoformat(),
    }
    inserted = sb.table("students").insert(row).execute()
    return _student_out(inserted.data[0])


@router.get("/me/dashboard", response_model=DashboardOut)
def dashboard(student=Depends(get_current_student)):
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    student_row = res.data[0]
    batch = Batch(student_row["batch"])
    join_date = student_row["join_date"]
    if isinstance(join_date, str):
        from datetime import date as _date

        join_date = _date.fromisoformat(join_date)

    period = current_period()
    due = compute_due(batch, join_date, period)

    payments = (
        sb.table("payments")
        .select("*")
        .eq("student_id", student["id"])
        .order("period", desc=True)
        .execute()
    ).data

    paid_periods = {p["period"] for p in payments if p["status"] == "paid"}
    current = CurrentDue(
        period=period,
        amount_paise=due.amount_paise,
        is_prorata=due.is_prorata,
        status="paid" if period in paid_periods else "unpaid",
    )

    history = [
        PaymentOut(
            period=p["period"],
            amount_paise=p["amount_paise"],
            is_prorata=p["is_prorata"],
            status=p["status"],
            paid_at=p.get("paid_at"),
        )
        for p in payments
    ]

    start, end = month_range(period)
    att = (
        sb.table("attendance")
        .select("id", count="exact")
        .eq("student_id", student["id"])
        .gte("date", start)
        .lt("date", end)
        .execute()
    )
    attendance_count = att.count or 0

    return DashboardOut(
        student=_student_out(student_row),
        current=current,
        history=history,
        attendance_this_month=attendance_count,
    )
