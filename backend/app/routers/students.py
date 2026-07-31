"""Student-facing routes: signup (profile + class) and read-only dashboard."""
from __future__ import annotations

from datetime import date as _date
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_student
from ..classes_store import class_label, get_class, slot_by_key, slot_label_of
from ..db import get_supabase
from ..fees import compute_due, current_period, now_local, period_of, previous_period
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


def _require_class(batch: str) -> dict:
    """Resolve the class a student is joining — must exist and be active."""
    cls = get_class(batch)
    if not cls or not cls.get("active", True):
        raise HTTPException(status_code=422, detail="Please choose a valid class")
    return cls


def _resolve_slot(cls: dict, raw_slot: str | None) -> str | None:
    """Validate the timing slot: required for classes that have slots, else None."""
    slot = (raw_slot or "").strip() or None
    if cls.get("slots"):
        if not slot_by_key(cls, slot):
            raise HTTPException(status_code=422, detail="Please choose a timing slot")
        return slot
    return None


def _student_out(row: dict, cls: dict | None = None) -> StudentOut:
    if cls is None:
        cls = get_class(row["batch"])
    slot = row.get("batch_slot")
    return StudentOut(
        id=row["id"],
        name=row["name"],
        email=row.get("email"),
        phone=row["phone"],
        batch=row["batch"],
        batch_label=class_label(cls),
        fee_type=cls.get("fee_type") if cls else None,
        batch_slot=slot,
        slot_label=slot_label_of(cls, slot),
        batch_deleted=cls is None or not cls.get("active", True),
        join_date=row["join_date"],
    )


@router.post("/signup", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, student=Depends(get_current_student)):
    """Attach profile + chosen class to the authenticated Supabase user.

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

    cls = _require_class(body.batch)
    slot = _resolve_slot(cls, body.batch_slot)

    # Validate the student-picked studio joining date: not in the future, and no
    # more than 30 days back (the frontend enforces the same window; this guards
    # direct API calls). Slightly lenient on the lower bound so a date the picker
    # allowed is never rejected here.
    today = now_local().date()
    if body.join_date > today:
        raise HTTPException(status_code=422, detail="Join date can't be in the future")
    if body.join_date < today - timedelta(days=31):
        raise HTTPException(status_code=422, detail="Join date can't be more than 30 days ago")

    row = {
        "id": student["id"],
        "name": body.name.strip(),
        # Login identity is the phone (via a synthetic auth email); no real email
        # is collected, so the students.email column stays null.
        "email": None,
        "phone": phone,
        "batch": cls["id"],
        "batch_slot": slot,
        # The studio joining date the student picked (drives pro-rata). The app
        # signup date is tracked separately by the row's created_at default.
        "join_date": body.join_date.isoformat(),
    }
    inserted = sb.table("students").insert(row).execute()
    return _student_out(inserted.data[0], cls)


@router.get("/me/profile", response_model=StudentOut)
def my_profile(student=Depends(get_current_student)):
    """Return the authenticated user's profile, or 404 if they haven't completed
    signup yet."""
    res = get_supabase().table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    return _student_out(res.data[0])


@router.patch("/me/profile", response_model=StudentOut)
def update_my_profile(body: UpdateProfileRequest, student=Depends(get_current_student)):
    """Let a student edit their own display name, phone and chosen class/timing.

    Email (the login identity) is intentionally not editable here.
    Changing the class recomputes the fee on the next dashboard load.
    """
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    cls = _require_class(body.batch)
    slot = _resolve_slot(cls, body.batch_slot)

    updates = {
        "name": body.name.strip(),
        "phone": phone,
        "batch": cls["id"],
        "batch_slot": slot,
    }
    updated = sb.table("students").update(updates).eq("id", student["id"]).execute()
    return _student_out(updated.data[0], cls)


@router.get("/me/dashboard", response_model=DashboardOut)
def dashboard(student=Depends(get_current_student)):
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    student_row = res.data[0]
    cls = get_class(student_row["batch"])
    # Deleted class → no fee computation (0 due) until reassigned.
    fee_cls = None if (cls is None or not cls.get("active", True)) else cls
    join_date = student_row["join_date"]
    if isinstance(join_date, str):
        join_date = _date.fromisoformat(join_date)

    period = current_period()
    due = compute_due(fee_cls, join_date, period)

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

    # Earlier months (join month .. last month) the student still owes. Enquiry /
    # deleted classes compute 0, so this stays empty for them.
    join_period = period_of(join_date)
    outstanding: list[CurrentDue] = []
    p = previous_period(period)
    while p >= join_period:
        if p not in paid_periods:
            past_due = compute_due(fee_cls, join_date, p)
            if past_due.amount_paise > 0:
                outstanding.append(
                    CurrentDue(
                        period=p,
                        amount_paise=past_due.amount_paise,
                        is_prorata=past_due.is_prorata,
                        status="unpaid",
                    )
                )
        p = previous_period(p)

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
        student=_student_out(student_row, cls),
        current=current,
        outstanding=outstanding,
        history=history,
    )
