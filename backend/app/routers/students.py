"""Student-facing routes: signup (profile + classes) and read-only dashboard.

A student can be enrolled in more than one class. ``enrollments`` is the source
of truth for which classes a student is in; ``students.batch/batch_slot/
join_date/whatsapp_joined`` mirror the FIRST class chosen at signup so legacy
reads (and the NOT NULL columns) stay valid, but every dashboard/payment
computation below reads from ``enrollments``.
"""
from __future__ import annotations

from datetime import date as _date
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_student
from ..classes_store import class_label, class_map, get_class, slot_by_key, slot_label_of
from ..db import get_supabase
from ..enrollments_store import (
    create_enrollment,
    get_enrollment,
    list_enrollments,
    set_whatsapp_joined,
)
from ..fees import compute_due, current_period, is_settled, now_local, period_of, previous_period
from ..payments_store import build_history, list_transactions
from ..schemas import (
    AddClassRequest,
    ClassChoice,
    CurrentDue,
    DashboardOut,
    EnrollmentOut,
    PaymentOut,
    SignupRequest,
    StudentProfile,
    UpdateProfileRequest,
)
from ..util import normalize_phone

router = APIRouter(prefix="/api", tags=["students"])


def _require_class(batch: str) -> dict:
    """Resolve a class a student is joining — must exist and be active."""
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


def _check_join_date(join_date: _date) -> None:
    # Not in the future, and no more than ~2 years back (the frontend enforces
    # the same window; this guards direct API calls). Slightly lenient on the
    # lower bound so a date the picker allowed is never rejected here.
    today = now_local().date()
    if join_date > today:
        raise HTTPException(status_code=422, detail="Join date can't be in the future")
    if join_date < today - timedelta(days=732):
        raise HTTPException(status_code=422, detail="Join date can't be more than 2 years ago")


def _student_profile(row: dict) -> StudentProfile:
    return StudentProfile(id=row["id"], name=row["name"], email=row.get("email"), phone=row["phone"])


def _payments_by_class(student_id: str) -> dict[str, list[dict]]:
    rows = (
        get_supabase()
        .table("payments")
        .select("*")
        .eq("student_id", student_id)
        .order("period", desc=True)
        .execute()
    ).data
    grouped: dict[str, list[dict]] = {}
    for p in rows:
        grouped.setdefault(p["class_id"], []).append(p)
    return grouped


def _enrollment_out(
    enr: dict, cmap: dict[str, dict], payments: list[dict], transactions: list[dict]
) -> EnrollmentOut:
    class_id = enr["class_id"]
    cls = cmap.get(class_id)
    # Deleted class → no fee computation (0 due) until reassigned.
    fee_cls = None if (cls is None or not cls.get("active", True)) else cls
    join_date = enr["join_date"]
    if isinstance(join_date, str):
        join_date = _date.fromisoformat(join_date)

    period = current_period()
    due = compute_due(fee_cls, join_date, period)

    # Months the admin has forgiven — never shown as owed.
    waived_periods = {p["period"] for p in payments if p["status"] == "waived"}
    # Partial cash/online recorded per month (may or may not fully cover the due).
    paid_so_far = {p["period"]: (p.get("paid_paise") or 0) for p in payments}
    this_sofar = paid_so_far.get(period, 0)
    if period in waived_periods:
        current = CurrentDue(period=period, amount_paise=0, is_prorata=False, status="waived", paid_paise=0)
    else:
        # Always compare what's been received against a FRESH due, not a stored
        # status flag — a join-date edit can raise what's actually owed for a
        # month that was already marked paid, and this is what surfaces the gap.
        settled = is_settled(due.amount_paise, this_sofar)
        current = CurrentDue(
            period=period,
            amount_paise=this_sofar if settled else max(due.amount_paise - this_sofar, 0),
            is_prorata=due.is_prorata,
            status="paid" if settled else "unpaid",
            paid_paise=this_sofar,
        )

    # Earlier months (join month .. last month) still owed for THIS class.
    join_period = period_of(join_date)
    outstanding: list[CurrentDue] = []
    p = previous_period(period)
    while p >= join_period:
        if p not in waived_periods:
            past_due = compute_due(fee_cls, join_date, p)
            received = paid_so_far.get(p, 0)
            remaining = past_due.amount_paise - received
            if remaining > 0:
                outstanding.append(
                    CurrentDue(
                        period=p,
                        amount_paise=remaining,
                        is_prorata=past_due.is_prorata,
                        status="unpaid",
                        paid_paise=received,
                    )
                )
        p = previous_period(p)

    # History = every individual payment received for this class — a partial
    # payment and its later remainder each show (and can be receipted)
    # separately, instead of being merged into one row per month.
    history = [PaymentOut(**h) for h in build_history(payments, transactions)]

    slot = enr.get("batch_slot")
    return EnrollmentOut(
        batch=class_id,
        batch_label=class_label(cls),
        fee_type=cls.get("fee_type") if cls else None,
        batch_slot=slot,
        slot_label=slot_label_of(cls, slot),
        batch_deleted=cls is None or not cls.get("active", True),
        join_date=join_date,
        whatsapp_joined=bool(enr.get("whatsapp_joined", False)),
        whatsapp_group_url=cls.get("whatsapp_group_url") if cls else None,
        # Inclusive of the join day (day 1), matching the home-screen stat.
        days_member=max((now_local().date() - join_date).days, 0) + 1,
        current=current,
        outstanding=outstanding,
        history=history,
    )


def _transactions_by_class(student_id: str) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for t in list_transactions(student_id):
        grouped.setdefault(t["class_id"], []).append(t)
    return grouped


def _dashboard_for(student_row: dict) -> DashboardOut:
    enrollments = list_enrollments(student_row["id"])
    cmap = class_map()
    payments = _payments_by_class(student_row["id"])
    transactions = _transactions_by_class(student_row["id"])
    return DashboardOut(
        student=_student_profile(student_row),
        enrollments=[
            _enrollment_out(e, cmap, payments.get(e["class_id"], []), transactions.get(e["class_id"], []))
            for e in enrollments
        ],
    )


@router.post("/signup", response_model=DashboardOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, student=Depends(get_current_student)):
    """Attach a profile + one or more classes to the authenticated Supabase user.

    The account itself (email/password) is created on the frontend via Supabase
    Auth; here we only create the matching ``students`` row (keyed to the
    verified user id) plus one ``enrollments`` row per chosen class. Idempotent:
    returns the existing dashboard if signup already ran for this account.
    """
    sb = get_supabase()
    existing = sb.table("students").select("*").eq("id", student["id"]).execute()
    if existing.data:
        return _dashboard_for(existing.data[0])

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    seen: set[str] = set()
    resolved: list[tuple[ClassChoice, dict, str | None]] = []
    for choice in body.classes:
        if choice.batch in seen:
            raise HTTPException(status_code=422, detail="Each class can only be chosen once")
        seen.add(choice.batch)
        cls = _require_class(choice.batch)
        slot = _resolve_slot(cls, choice.batch_slot)
        resolved.append((choice, cls, slot))

    _check_join_date(body.join_date)

    first_choice, first_cls, first_slot = resolved[0]
    row = {
        "id": student["id"],
        "name": body.name.strip(),
        # Login identity is the phone (via a synthetic auth email); no real email
        # is collected, so the students.email column stays null.
        "email": None,
        "phone": phone,
        "batch": first_cls["id"],
        "batch_slot": first_slot,
        # The studio joining date the student picked (drives pro-rata). The app
        # signup date is tracked separately by the row's created_at default.
        "join_date": body.join_date.isoformat(),
    }
    inserted = sb.table("students").insert(row).execute().data[0]

    for choice, cls, slot in resolved:
        create_enrollment(student["id"], cls["id"], slot, body.join_date.isoformat())

    return _dashboard_for(inserted)


@router.get("/me/profile", response_model=StudentProfile)
def my_profile(student=Depends(get_current_student)):
    """Return the authenticated user's identity, or 404 if they haven't completed
    signup yet."""
    res = get_supabase().table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    return _student_profile(res.data[0])


@router.patch("/me/profile", response_model=StudentProfile)
def update_my_profile(body: UpdateProfileRequest, student=Depends(get_current_student)):
    """Let a student edit their own display name and phone.

    Email (the login identity) is not editable here. Class membership is
    managed via "Add a class" (adding) or the admin (editing/removing).
    """
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    updates = {"name": body.name.strip(), "phone": phone}
    updated = sb.table("students").update(updates).eq("id", student["id"]).execute()
    return _student_profile(updated.data[0])


@router.post("/me/enrollments/{class_id}/whatsapp-joined")
def mark_whatsapp_joined(class_id: str, student=Depends(get_current_student)):
    """Record that the student has joined THIS class's WhatsApp group (they
    tapped the Join button). Idempotent — safe to call again. Clears the
    reminder for good across devices since it lives on the enrollment row, not
    in localStorage."""
    if not get_enrollment(student["id"], class_id):
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    set_whatsapp_joined(student["id"], class_id)
    return {"status": "ok"}


@router.post("/me/classes", response_model=DashboardOut, status_code=status.HTTP_201_CREATED)
def add_class(body: AddClassRequest, student=Depends(get_current_student)):
    """Join an additional class from the hamburger menu. Add-only — a student
    can't remove a class themselves; that's an admin action."""
    res = get_supabase().table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")

    cls = _require_class(body.batch)
    slot = _resolve_slot(cls, body.batch_slot)
    if get_enrollment(student["id"], body.batch):
        raise HTTPException(status_code=409, detail="You're already in this class")
    _check_join_date(body.join_date)

    create_enrollment(student["id"], cls["id"], slot, body.join_date.isoformat())
    return _dashboard_for(res.data[0])


@router.get("/me/dashboard", response_model=DashboardOut)
def dashboard(student=Depends(get_current_student)):
    res = get_supabase().table("students").select("*").eq("id", student["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    return _dashboard_for(res.data[0])
