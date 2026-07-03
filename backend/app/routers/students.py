"""Student-facing routes: signup (profile + batch) and read-only dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_student
from ..constants import BATCH_LABELS, TRADITIONAL_SLOTS, Batch, batch_info, slot_label
from ..db import get_supabase
from ..fees import compute_due, current_period, now_local
from ..schemas import (
    CurrentDue,
    DashboardOut,
    PaymentOut,
    SignupRequest,
    StudentOut,
    UpdateProfileRequest,
)
from ..util import normalize_phone

router = APIRouter(prefix="/api", tags=["students"])


def _resolve_slot(batch: Batch, raw_slot: str | None) -> str | None:
    """Validate the timing slot for a batch. Slot is required (and must be a known
    key) for batches that have slots; ignored (forced to None) otherwise."""
    slot = (raw_slot or "").strip() or None
    if batch_info(batch).has_slots:
        if slot not in TRADITIONAL_SLOTS:
            raise HTTPException(status_code=422, detail="Please choose a timing slot")
        return slot
    return None


def _student_out(row: dict) -> StudentOut:
    batch = Batch(row["batch"])
    slot = row.get("batch_slot")
    return StudentOut(
        id=row["id"],
        name=row["name"],
        email=row.get("email"),
        phone=row["phone"],
        batch=batch,
        batch_label=BATCH_LABELS[batch],
        batch_slot=slot,
        slot_label=slot_label(slot),
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

    # Timing slot: required (and validated) for batches that have slots; ignored
    # otherwise so a stray value can't be stored against a slot-less batch.
    slot = _resolve_slot(body.batch, body.batch_slot)

    row = {
        "id": student["id"],
        "name": body.name.strip(),
        "email": student["email"] or None,
        "phone": phone,
        "batch": body.batch.value,
        "batch_slot": slot,
        "join_date": now_local().date().isoformat(),
    }
    inserted = sb.table("students").insert(row).execute()
    return _student_out(inserted.data[0])


@router.get("/me/profile", response_model=StudentOut)
def my_profile(student=Depends(get_current_student)):
    """Return the authenticated user's profile, or 404 if they haven't completed
    signup yet. Used right after OTP verification to route new vs returning users."""
    res = get_supabase().table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    return _student_out(res.data[0])


@router.patch("/me/profile", response_model=StudentOut)
def update_my_profile(body: UpdateProfileRequest, student=Depends(get_current_student)):
    """Let a student edit their own display name, phone and chosen batch/timing.

    Email (the login identity) is intentionally not editable here.
    Changing the batch recomputes the fee on the next dashboard load.
    """
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    slot = _resolve_slot(body.batch, body.batch_slot)

    updates = {
        "name": body.name.strip(),
        "phone": phone,
        "batch": body.batch.value,
        "batch_slot": slot,
    }
    updated = (
        sb.table("students").update(updates).eq("id", student["id"]).execute()
    )
    return _student_out(updated.data[0])


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

    return DashboardOut(
        student=_student_out(student_row),
        current=current,
        history=history,
    )
