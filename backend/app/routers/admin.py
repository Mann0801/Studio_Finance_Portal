"""Admin routes: single hardcoded login, dynamic class CRUD, per-class student
lists, and stats.

A student can be enrolled in more than one class, each an independent payment
thread. Most of what used to be "one row per student" below is now "one row
per (student, class) enrollment" — a student in two classes shows up twice,
once per class, each with its own paid/unpaid status."""
from __future__ import annotations

import secrets
from datetime import date as _date

from fastapi import APIRouter, Depends, HTTPException

from ..auth import create_admin_token, require_admin, verify_admin_credentials
from ..classes_store import (
    class_label,
    class_map,
    create_class,
    get_class,
    list_classes,
    slot_by_key,
    slot_label_of,
    soft_delete_class,
    unique_slug,
    update_class,
)
from ..constants import ENQUIRY, FEE_TYPES, SESSION_PACK
from ..db import get_supabase
from ..enrollments_store import (
    all_enrollments,
    create_enrollment,
    delete_enrollment,
    get_enrollment,
    list_enrollments,
    student_count,
    student_counts,
    update_enrollment,
)
from ..fees import (
    compute_due,
    current_period,
    is_settled,
    now_local,
    parse_period,
    period_of,
    previous_period,
)
from ..payments_store import (
    amount_paid_for,
    delete_payment,
    is_period_waived,
    payment_method_label,
    record_cash_payment,
    waive_period,
)
from ..schemas import (
    ActivityPayment,
    ActivitySignup,
    AdminActivity,
    AdminAddEnrollmentRequest,
    AdminClassRow,
    AdminCreateStudentRequest,
    AdminCreateStudentResponse,
    AdminEnrollmentDetail,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminMonthRow,
    AdminMonthView,
    AdminPaymentRow,
    AdminResetPasswordResponse,
    AdminStats,
    AdminStudentDetail,
    AdminStudentRow,
    AdminUpdateEnrollmentRequest,
    AdminUpdateStudentRequest,
    BatchStat,
    ClassDeleteResponse,
    ClassWriteRequest,
    CurrentDue,
    MarkPaidRequest,
    PeriodActionRequest,
    SlotStat,
    StudentPaymentRow,
    WhatsAppLinkRequest,
)
from ..services.whatsapp import reminder_link
from ..util import normalize_phone, phone_login_email


router = APIRouter(prefix="/api/admin", tags=["admin"])


def _as_date(value) -> _date:
    return _date.fromisoformat(value) if isinstance(value, str) else value


def _deleted(cls: dict | None) -> bool:
    """A class is 'deleted' when its row is gone or soft-deleted."""
    return cls is None or not cls.get("active", True)


def _fee_cls(cls: dict | None) -> dict | None:
    """Class used for fee computation — None (0 due) for a deleted class."""
    return None if _deleted(cls) else cls


def _reminder_label(cls: dict | None, slot_time: str | None) -> str:
    name = class_label(cls)
    return f"{name} ({slot_time})" if slot_time else name


def _resolve_slot(cls: dict, raw_slot: str | None) -> str | None:
    """Validate the timing slot: required (and a known key) for classes that have
    slots, forced to None otherwise."""
    slot = (raw_slot or "").strip() or None
    if cls.get("slots"):
        if not slot_by_key(cls, slot):
            raise HTTPException(status_code=422, detail="Please choose a timing slot")
        return slot
    return None


def _received_amounts_for_period(period: str, class_id: str | None = None) -> dict[tuple[str, str], int]:
    """Map (student_id, class_id) -> total paise received for `period`, INCLUDING
    partial cash on months not yet fully paid. Used for revenue (real money in hand)."""
    q = (
        get_supabase()
        .table("payments")
        .select("student_id, class_id, paid_paise")
        .eq("period", period)
    )
    if class_id is not None:
        q = q.eq("class_id", class_id)
    return {(r["student_id"], r["class_id"]): (r.get("paid_paise") or 0) for r in q.execute().data}


def _waived_keys_for_period(period: str) -> set[tuple[str, str]]:
    """(student_id, class_id) pairs whose fee for `period` has been waived —
    forgiven, no money expected or owed."""
    rows = (
        get_supabase()
        .table("payments")
        .select("student_id, class_id")
        .eq("period", period)
        .eq("status", "waived")
        .execute()
        .data
    )
    return {(r["student_id"], r["class_id"]) for r in rows}


def _collection_rate(actual: int, expected: int) -> float:
    """Actual / expected as a 0–100 percentage, rounded to 1 dp."""
    if expected <= 0:
        return 0.0
    return round(actual / expected * 100, 1)


def _valid_period(period: str | None) -> str:
    """Validate an optional YYYY-MM query param; default to the current month.
    A future month is rejected (nothing has been billed yet)."""
    if not period:
        return current_period()
    try:
        parse_period(period)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid month")
    if period > current_period():
        raise HTTPException(status_code=400, detail="That month hasn't started yet")
    return period


@router.post("/login", response_model=AdminLoginResponse)
def login(body: AdminLoginRequest):
    if not verify_admin_credentials(body.email, body.password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return AdminLoginResponse(token=create_admin_token())


# ── Class management ──────────────────────────────────────────────────────────
def _prep_slots(slots) -> list[dict]:
    """Store slots as {key,name,start,end}, keys unique + stable. Frontend keeps
    existing keys so a student's saved batch_slot never breaks on edit."""
    out: list[dict] = []
    seen: set[str] = set()
    for i, s in enumerate(slots):
        key = (s.key or f"slot{i + 1}").strip()
        while key in seen:
            key = f"{key}_{i + 1}"
        seen.add(key)
        out.append({"key": key, "name": s.name.strip(), "start": s.start, "end": s.end})
    return out


def _class_payload(body: ClassWriteRequest) -> dict:
    if body.fee_type not in FEE_TYPES:
        raise HTTPException(status_code=422, detail="Invalid fee type")
    if body.fee_type == SESSION_PACK and not body.sessions_per_month:
        raise HTTPException(status_code=422, detail="Sessions per month is required")
    slots = _prep_slots(body.slots)
    return {
        "name": body.name.strip(),
        "fee_type": body.fee_type,
        "fee_paise": 0 if body.fee_type == ENQUIRY else max(body.fee_paise or 0, 0),
        "sessions_per_month": body.sessions_per_month if body.fee_type == SESSION_PACK else None,
        "schedule_days": sorted({d for d in body.schedule_days if 0 <= d <= 6}),
        "slots": slots,
        "start_time": None if slots else (body.start_time or None),
        "end_time": None if slots else (body.end_time or None),
        "description": (body.description or "").strip() or None,
    }


def _class_row(c: dict, count: int) -> AdminClassRow:
    return AdminClassRow(**c, student_count=count)


@router.get("/classes", response_model=list[AdminClassRow], dependencies=[Depends(require_admin)])
def list_all_classes():
    """Every class (active + soft-deleted) with its enrollment count. Counts come
    from one query (student_counts) rather than a per-class round-trip."""
    counts = student_counts()
    return [_class_row(c, counts.get(c["id"], 0)) for c in list_classes()]


@router.post("/classes", response_model=AdminClassRow, dependencies=[Depends(require_admin)])
def create_new_class(body: ClassWriteRequest):
    payload = _class_payload(body)
    existing = list_classes()
    payload["id"] = unique_slug(body.name)
    payload["active"] = True
    payload["sort_order"] = max((c.get("sort_order") or 0) for c in existing) + 1 if existing else 0
    return _class_row(create_class(payload), 0)  # brand-new class has no students


@router.patch(
    "/classes/{class_id}", response_model=AdminClassRow, dependencies=[Depends(require_admin)]
)
def edit_class(class_id: str, body: ClassWriteRequest):
    if not get_class(class_id):
        raise HTTPException(status_code=404, detail="Class not found")
    updated = update_class(class_id, _class_payload(body))
    return _class_row(updated, student_count(class_id))


@router.patch(
    "/classes/{class_id}/whatsapp",
    response_model=AdminClassRow,
    dependencies=[Depends(require_admin)],
)
def set_class_whatsapp(class_id: str, body: WhatsAppLinkRequest):
    """Set or switch a class's WhatsApp group link. Reflects for students on their
    next dashboard load (they read the link off the class)."""
    if not get_class(class_id):
        raise HTTPException(status_code=404, detail="Class not found")
    url = (body.whatsapp_group_url or "").strip() or None
    updated = update_class(class_id, {"whatsapp_group_url": url})
    return _class_row(updated, student_count(class_id))


@router.delete(
    "/classes/{class_id}", response_model=ClassDeleteResponse, dependencies=[Depends(require_admin)]
)
def remove_class(class_id: str):
    if not get_class(class_id):
        raise HTTPException(status_code=404, detail="Class not found")
    count = student_count(class_id)
    soft_delete_class(class_id)
    return ClassDeleteResponse(status="deleted", student_count=count)


# ── Students by class ─────────────────────────────────────────────────────────
def _students_by_id(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    rows = (
        get_supabase()
        .table("students")
        .select("id, name, email, phone, created_at")
        .in_("id", list(set(ids)))
        .execute()
        .data
    )
    return {s["id"]: s for s in rows}


def _enrollments_by_class(class_id: str) -> list[dict]:
    return (
        get_supabase()
        .table("enrollments")
        .select("*")
        .eq("class_id", class_id)
        .execute()
        .data
    )


@router.get(
    "/batches/{batch}",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def list_batch(batch: str, slot: str | None = None, period: str | None = None):
    """Students in a class (optionally one timing slot) with their paid/unpaid
    status for a month. Defaults to the current month; an earlier month shows who
    had paid then (members who hadn't joined yet are left out)."""
    period = _valid_period(period)
    cls = get_class(batch)
    deleted = _deleted(cls)
    enrolls = _enrollments_by_class(batch)
    # Classes with timing slots can be filtered to a single slot.
    if cls and cls.get("slots") and slot:
        enrolls = [e for e in enrolls if e.get("batch_slot") == slot]
    # Only members who had joined by the selected month owed a fee then.
    enrolls = [e for e in enrolls if period >= period_of(_as_date(e["join_date"]))]
    smap = _students_by_id([e["student_id"] for e in enrolls])
    received = _received_amounts_for_period(period, batch)
    waived = _waived_keys_for_period(period)

    rows: list[AdminStudentRow] = []
    for e in enrolls:
        s = smap.get(e["student_id"])
        if not s:
            continue
        join_date = _as_date(e["join_date"])
        due = compute_due(_fee_cls(cls), join_date, period)
        key = (e["student_id"], batch)
        is_waived = key in waived
        received_amt = received.get(key, 0)
        # Always compare against a fresh due, not a stored status flag — a
        # join-date edit can raise what's owed for a month already marked paid.
        is_paid = not is_waived and is_settled(due.amount_paise, received_amt)
        # For an unpaid student, show what's still owed (fee minus any partial cash).
        amount = 0 if is_waived else received_amt if is_paid else max(due.amount_paise - received_amt, 0)
        sl = slot_label_of(cls, e.get("batch_slot"))
        wa = None
        if not is_paid and not is_waived and amount > 0:
            wa = reminder_link(s["phone"], s["name"], _reminder_label(cls, sl), amount, period)
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s.get("email"),
                phone=s["phone"],
                batch=batch,
                batch_label=class_label(cls),
                batch_slot=e.get("batch_slot"),
                slot_label=sl,
                batch_deleted=deleted,
                join_date=join_date,
                period=period,
                amount_paise=amount,
                is_prorata=due.is_prorata,
                status="waived" if is_waived else "paid" if is_paid else "unpaid",
                whatsapp_url=wa,
            )
        )
    rows.sort(key=lambda r: r.name)
    return rows


@router.get(
    "/students",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def all_students():
    """Every enrollment across every class with its current-month status — powers
    the universal search on the Students tab. A student in two classes appears
    twice, once per class."""
    period = current_period()
    cmap = class_map()
    enrolls = all_enrollments()
    smap = _students_by_id([e["student_id"] for e in enrolls])
    received = _received_amounts_for_period(period)
    waived = _waived_keys_for_period(period)

    rows: list[AdminStudentRow] = []
    for e in enrolls:
        s = smap.get(e["student_id"])
        if not s:
            continue
        cls = cmap.get(e["class_id"])
        join_date = _as_date(e["join_date"])
        due = compute_due(_fee_cls(cls), join_date, period)
        key = (e["student_id"], e["class_id"])
        is_waived = key in waived
        received_amt = received.get(key, 0)
        is_paid = not is_waived and is_settled(due.amount_paise, received_amt)
        amount = 0 if is_waived else received_amt if is_paid else max(due.amount_paise - received_amt, 0)
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s.get("email"),
                phone=s["phone"],
                batch=e["class_id"],
                batch_label=class_label(cls),
                batch_slot=e.get("batch_slot"),
                slot_label=slot_label_of(cls, e.get("batch_slot")),
                batch_deleted=_deleted(cls),
                join_date=join_date,
                signed_up_at=s.get("created_at"),
                period=period,
                amount_paise=amount,
                is_prorata=due.is_prorata,
                status="waived" if is_waived else "paid" if is_paid else "unpaid",
                whatsapp_url=None,
            )
        )
    rows.sort(key=lambda r: r.name)
    return rows


@router.get("/stats", response_model=AdminStats, dependencies=[Depends(require_admin)])
def stats():
    period = current_period()
    prev = previous_period(period)
    enrolls = all_enrollments()
    received = _received_amounts_for_period(period)      # incl. partial cash → revenue
    waived = _waived_keys_for_period(period)              # forgiven → not owed, not paid
    last_month_received = _received_amounts_for_period(prev)
    classes = list_classes()

    def _group_stat(fee_cls: dict | None, members: list[dict]):
        # A waived enrollment is settled (nothing owed) — counted alongside paid
        # ones so paid_count + unpaid_count still equals total_students. "Paid"
        # is always a fresh amount-vs-due comparison, not a stored status flag —
        # a join-date edit can raise what's owed for a month already marked paid.
        settled_keys = []
        revenue = 0
        expected = 0
        for m in members:
            key = (m["student_id"], m["class_id"])
            received_amt = received.get(key, 0)
            revenue += received_amt
            if key in waived:
                settled_keys.append(key)
                continue
            due_paise = compute_due(fee_cls, _as_date(m["join_date"]), period).amount_paise
            expected += due_paise
            if is_settled(due_paise, received_amt):
                settled_keys.append(key)
        return settled_keys, revenue, expected

    per_batch: list[BatchStat] = []
    # NOTE: totals here count ENROLLMENTS, not distinct people — a student in two
    # classes counts twice, once per class. Keeps paid_count + unpaid_count ==
    # total_students always true (the per-class tiles mean the same thing).
    total_paid = total_students = total_revenue = total_expected = 0
    for cls in classes:
        members = [e for e in enrolls if e["class_id"] == cls["id"]]
        # Soft-deleted classes only stay visible while they still hold students
        # (so the admin can reassign them); hide empty removed classes.
        if not cls.get("active", True) and not members:
            continue
        fee_cls = _fee_cls(cls)
        paid_keys, revenue, expected = _group_stat(fee_cls, members)

        # Per-timing breakdown for classes that have slots.
        slots: list[SlotStat] = []
        for slot in cls.get("slots") or []:
            smembers = [m for m in members if m.get("batch_slot") == slot["key"]]
            s_paid_keys, s_rev, s_exp = _group_stat(fee_cls, smembers)
            slots.append(
                SlotStat(
                    slot=slot["key"],
                    slot_label=slot_label_of(cls, slot["key"]) or slot.get("name", ""),
                    total_students=len(smembers),
                    paid_count=len(s_paid_keys),
                    unpaid_count=len(smembers) - len(s_paid_keys),
                    revenue_paise=s_rev,
                    expected_paise=s_exp,
                    collection_rate=_collection_rate(s_rev, s_exp),
                )
            )

        per_batch.append(
            BatchStat(
                batch=cls["id"],
                batch_label=class_label(cls),
                total_students=len(members),
                paid_count=len(paid_keys),
                unpaid_count=len(members) - len(paid_keys),
                revenue_paise=revenue,
                expected_paise=expected,
                collection_rate=_collection_rate(revenue, expected),
                slots=slots,
            )
        )
        total_students += len(members)
        total_paid += len(paid_keys)
        total_revenue += revenue
        total_expected += expected

    last_month_revenue = sum(last_month_received.values())
    if last_month_revenue > 0:
        revenue_change_pct = round(
            (total_revenue - last_month_revenue) / last_month_revenue * 100, 1
        )
    else:
        revenue_change_pct = 100.0 if total_revenue > 0 else 0.0

    return AdminStats(
        period=period,
        total_students=total_students,
        paid_count=total_paid,
        unpaid_count=total_students - total_paid,
        revenue_paise=total_revenue,
        expected_paise=total_expected,
        collection_rate=_collection_rate(total_revenue, total_expected),
        last_month_revenue_paise=last_month_revenue,
        revenue_change_pct=revenue_change_pct,
        per_batch=per_batch,
    )


@router.get(
    "/unpaid",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def unpaid_students():
    """Every enrollment that still owes this month, each with a prefilled
    WhatsApp reminder link. Powers the admin "Send reminders" list."""
    period = current_period()
    cmap = class_map()
    enrolls = all_enrollments()
    smap = _students_by_id([e["student_id"] for e in enrolls])
    received = _received_amounts_for_period(period)
    waived = _waived_keys_for_period(period)

    rows: list[AdminStudentRow] = []
    for e in enrolls:
        key = (e["student_id"], e["class_id"])
        if key in waived:
            continue
        s = smap.get(e["student_id"])
        if not s:
            continue
        cls = cmap.get(e["class_id"])
        due = compute_due(_fee_cls(cls), _as_date(e["join_date"]), period)
        # Remind for what's still owed after any partial cash already recorded.
        remaining = due.amount_paise - received.get(key, 0)
        if remaining <= 0:
            continue
        sl = slot_label_of(cls, e.get("batch_slot"))
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s.get("email"),
                phone=s["phone"],
                batch=e["class_id"],
                batch_label=class_label(cls),
                batch_slot=e.get("batch_slot"),
                slot_label=sl,
                batch_deleted=_deleted(cls),
                join_date=_as_date(e["join_date"]),
                period=period,
                amount_paise=remaining,
                is_prorata=due.is_prorata,
                status="unpaid",
                whatsapp_url=reminder_link(
                    s["phone"], s["name"], _reminder_label(cls, sl), remaining, period
                ),
            )
        )
    rows.sort(key=lambda r: r.name)
    return rows


@router.get("/activity", response_model=AdminActivity, dependencies=[Depends(require_admin)])
def activity():
    """Home feed: recent new signups/enrollments (shown in a fixed-height scroll
    widget). recent_payments is still returned for API compatibility."""
    sb = get_supabase()
    cmap = class_map()
    pays = (
        sb.table("payments")
        .select("student_id, class_id, amount_paise, paid_at")
        .eq("status", "paid")
        .order("paid_at", desc=True)
        .limit(5)
        .execute()
    ).data
    smap = _students_by_id([p["student_id"] for p in pays])

    recent_payments: list[ActivityPayment] = []
    for p in pays:
        s = smap.get(p["student_id"])
        if not s:
            continue
        cls = cmap.get(p["class_id"])
        recent_payments.append(
            ActivityPayment(
                name=s["name"],
                batch=p["class_id"],
                batch_label=class_label(cls),
                amount_paise=p["amount_paise"],
                paid_at=p.get("paid_at"),
            )
        )

    enrolls = (
        sb.table("enrollments")
        .select("student_id, class_id, join_date, created_at")
        .order("created_at", desc=True)
        .limit(15)
        .execute()
    ).data
    smap2 = _students_by_id([e["student_id"] for e in enrolls])
    recent_signups = []
    for e in enrolls:
        s = smap2.get(e["student_id"])
        if not s:
            continue
        recent_signups.append(
            ActivitySignup(
                id=s["id"],
                name=s["name"],
                batch=e["class_id"],
                batch_label=class_label(cmap.get(e["class_id"])),
                join_date=_as_date(e["join_date"]),
                signed_up_at=e.get("created_at"),
            )
        )

    return AdminActivity(recent_payments=recent_payments, recent_signups=recent_signups)


@router.get(
    "/signups",
    response_model=list[ActivitySignup],
    dependencies=[Depends(require_admin)],
)
def all_signups():
    """Every signup/enrollment ever made, most recent first — the full history
    behind Home's 'New signups' feed (which only shows the latest handful)."""
    sb = get_supabase()
    cmap = class_map()
    enrolls = (
        sb.table("enrollments")
        .select("student_id, class_id, join_date, created_at")
        .order("created_at", desc=True)
        .execute()
    ).data
    smap = _students_by_id([e["student_id"] for e in enrolls])
    rows: list[ActivitySignup] = []
    for e in enrolls:
        s = smap.get(e["student_id"])
        if not s:
            continue
        rows.append(
            ActivitySignup(
                id=s["id"],
                name=s["name"],
                batch=e["class_id"],
                batch_label=class_label(cmap.get(e["class_id"])),
                join_date=_as_date(e["join_date"]),
                signed_up_at=e.get("created_at"),
            )
        )
    return rows


@router.get(
    "/payments",
    response_model=list[AdminPaymentRow],
    dependencies=[Depends(require_admin)],
)
def payment_history(limit: int = 100):
    """All received payments, newest first (joined to student name + class).
    Includes partial cash (any row with money received), showing the amount
    actually collected."""
    sb = get_supabase()
    cmap = class_map()
    pays = (
        sb.table("payments")
        .select("id, student_id, class_id, amount_paise, paid_paise, status, period, paid_at, razorpay_payment_id")
        .gt("paid_paise", 0)  # anything with money in — full or partial
        .order("paid_at", desc=True)
        .limit(limit)
        .execute()
    ).data
    smap = _students_by_id([p["student_id"] for p in pays])
    slots = {
        (e["student_id"], e["class_id"]): e.get("batch_slot")
        for e in all_enrollments()
    }

    rows: list[AdminPaymentRow] = []
    for p in pays:
        s = smap.get(p["student_id"])
        if not s:
            continue
        cls = cmap.get(p["class_id"])
        sl = slot_label_of(cls, slots.get((p["student_id"], p["class_id"])))
        rows.append(
            AdminPaymentRow(
                id=p["id"],
                name=s["name"],
                batch=p["class_id"],
                batch_label=class_label(cls),
                slot_label=sl,
                amount_paise=p.get("paid_paise") or 0,  # amount actually collected
                period=p["period"],
                paid_at=p.get("paid_at"),
                method=payment_method_label(p),
                is_partial=p["status"] != "paid",
            )
        )
    return rows


@router.get(
    "/month/{period}",
    response_model=AdminMonthView,
    dependencies=[Depends(require_admin)],
)
def month_view(period: str):
    """Every enrollment's payment status for a single calendar month, across all
    classes — the month-wise roster so the admin can see who's paid and who still
    owes without opening each student. The UI defaults to the current month and
    steps back to earlier months, which show their historical state."""
    period = _valid_period(period)
    cur = current_period()
    sb = get_supabase()
    cmap = class_map()
    enrolls = all_enrollments()
    smap = _students_by_id([e["student_id"] for e in enrolls])
    pays = (
        sb.table("payments")
        .select("student_id, class_id, amount_paise, paid_paise, status, paid_at, razorpay_payment_id")
        .eq("period", period)
        .execute()
    ).data
    pmap = {(p["student_id"], p["class_id"]): p for p in pays}

    rows: list[AdminMonthRow] = []
    collected = expected = paid_count = unpaid_count = 0
    for e in enrolls:
        s = smap.get(e["student_id"])
        if not s:
            continue
        join_date = _as_date(e["join_date"])
        # Nothing was owed before they joined this class.
        if period < period_of(join_date):
            continue
        cls = cmap.get(e["class_id"])
        due = compute_due(_fee_cls(cls), join_date, period)
        pay = pmap.get((e["student_id"], e["class_id"]))
        is_waived = bool(pay and pay["status"] == "waived")
        paid_paise = (pay.get("paid_paise") or 0) if pay else 0
        due_paise = 0 if is_waived else due.amount_paise
        # Skip months with no fee and no money in (enquiry / deleted class);
        # a waived month is shown so it doesn't look like a missing row.
        if due_paise <= 0 and paid_paise <= 0 and not is_waived:
            continue
        # A fresh amount-vs-due comparison, not the stored status flag — a
        # join-date edit can raise what's owed for a month already marked paid.
        is_paid = (not is_waived) and is_settled(due_paise, paid_paise)
        status = "waived" if is_waived else "paid" if is_paid else ("partial" if paid_paise > 0 else "unpaid")
        remaining = max(due_paise - paid_paise, 0)
        sl = slot_label_of(cls, e.get("batch_slot"))
        wa = None
        if not is_paid and not is_waived and remaining > 0:
            wa = reminder_link(s["phone"], s["name"], _reminder_label(cls, sl), remaining, period)
        rows.append(
            AdminMonthRow(
                id=s["id"],
                name=s["name"],
                batch=e["class_id"],
                batch_label=class_label(cls),
                slot_label=sl,
                due_paise=due_paise,
                paid_paise=paid_paise,
                status=status,
                method=payment_method_label(pay) if (pay and paid_paise > 0) else None,
                paid_at=pay.get("paid_at") if pay else None,
                is_prorata=due.is_prorata,
                whatsapp_url=wa,
            )
        )
        collected += paid_paise
        expected += due_paise
        if is_paid or is_waived:
            paid_count += 1
        else:
            unpaid_count += 1

    rows.sort(key=lambda r: r.name)
    return AdminMonthView(
        period=period,
        is_current=(period == cur),
        collected_paise=collected,
        expected_paise=expected,
        paid_count=paid_count,
        unpaid_count=unpaid_count,
        rows=rows,
    )


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


def _build_enrollment_detail(
    enr: dict, s: dict, cmap: dict[str, dict], payments: list[dict]
) -> AdminEnrollmentDetail:
    class_id = enr["class_id"]
    cls = cmap.get(class_id)
    deleted = _deleted(cls)
    join_date = _as_date(enr["join_date"])
    period = current_period()
    due = compute_due(_fee_cls(cls), join_date, period)

    paid_rows = [p for p in payments if p["status"] == "paid"]
    # Total received includes partial cash on months not yet fully paid.
    total_paid = sum((p.get("paid_paise") or 0) for p in payments)
    last = max(paid_rows, key=lambda p: p.get("paid_at") or "", default=None)
    paid_so_far = {p["period"]: (p.get("paid_paise") or 0) for p in payments}
    # Months the admin has forgiven — never shown as owed.
    waived_periods = {p["period"] for p in payments if p["status"] == "waived"}
    this_waived = period in waived_periods

    # Earlier months (join month .. last month) still owed for THIS class — so
    # the admin can record cash against an old unpaid month, not just the
    # current one. Partial cash reduces the balance shown but keeps the month
    # owing until cleared. Always a fresh amount-vs-due comparison, not a
    # stored status flag — a join-date edit can raise what's owed for a month
    # already marked paid, and this is what surfaces the gap.
    join_period = period_of(join_date)
    outstanding: list[CurrentDue] = []
    p = previous_period(period)
    while p >= join_period:
        if p not in waived_periods:
            past_due = compute_due(_fee_cls(cls), join_date, p)
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

    # Show every month money was received for this class — fully paid or partial cash.
    history = [
        StudentPaymentRow(
            period=p["period"],
            amount_paise=p["amount_paise"],
            paid_at=p.get("paid_at"),
            method=payment_method_label(p),
            status=p["status"],
            paid_paise=(p.get("paid_paise") or 0),
        )
        for p in payments
        if p["status"] == "paid" or (p.get("paid_paise") or 0) > 0
    ]

    this_sofar = paid_so_far.get(period, 0)
    this_settled = not this_waived and is_settled(due.amount_paise, this_sofar)
    this_remaining = 0 if this_waived else max(due.amount_paise - this_sofar, 0)
    sl = slot_label_of(cls, enr.get("batch_slot"))
    wa = None
    if not this_settled and not this_waived and this_remaining > 0:
        wa = reminder_link(s["phone"], s["name"], _reminder_label(cls, sl), this_remaining, period)

    return AdminEnrollmentDetail(
        batch=class_id,
        batch_label=class_label(cls),
        fee_type=cls.get("fee_type") if cls else None,
        batch_slot=enr.get("batch_slot"),
        slot_label=sl,
        batch_deleted=deleted,
        join_date=join_date,
        days_member=max((now_local().date() - join_date).days, 0),
        whatsapp_joined=bool(enr.get("whatsapp_joined", False)),
        period=period,
        amount_paise=this_sofar if this_settled else this_remaining,
        is_prorata=due.is_prorata,
        status="waived" if this_waived else "paid" if this_settled else "unpaid",
        paid_paise=this_sofar,
        outstanding=outstanding,
        total_paid_paise=total_paid,
        last_payment_paise=last["amount_paise"] if last else None,
        last_payment_at=last.get("paid_at") if last else None,
        payments=history,
        whatsapp_url=wa,
    )


def _build_student_detail(s: dict) -> AdminStudentDetail:
    cmap = class_map()
    enrolls = list_enrollments(s["id"])
    payments_by_class = _payments_by_class(s["id"])
    details = [
        _build_enrollment_detail(e, s, cmap, payments_by_class.get(e["class_id"], []))
        for e in enrolls
    ]
    return AdminStudentDetail(
        id=s["id"],
        name=s["name"],
        email=s.get("email"),
        phone=s["phone"],
        signed_up_at=s.get("created_at"),
        enrollments=details,
        total_paid_paise=sum(d.total_paid_paise for d in details),
    )


def _load_student_or_404(student_id: str) -> dict:
    res = get_supabase().table("students").select("*").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    return res.data[0]


def _require_class(batch: str) -> dict:
    """Resolve a class the admin is assigning a student to — must exist + active."""
    cls = get_class(batch)
    if not cls or not cls.get("active", True):
        raise HTTPException(status_code=422, detail="Please choose a valid class")
    return cls


@router.get(
    "/students/{student_id}",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def student_detail(student_id: str):
    return _build_student_detail(_load_student_or_404(student_id))


@router.post(
    "/students",
    response_model=AdminCreateStudentResponse,
    dependencies=[Depends(require_admin)],
)
def create_student(body: AdminCreateStudentRequest):
    """Register a walk-in member. Creates the Supabase Auth user (keyed to a
    synthetic email derived from the phone, so they log in with phone + password)
    plus the matching students row and one enrollment per chosen class — all
    sharing the one join date, same as student signup. If no password is given,
    a temporary one is generated and returned for the admin to share."""
    sb = get_supabase()

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    # Phone is the login identity (via a synthetic auth email — must match the
    # frontend's phoneToEmail so the same phone always resolves to this account).
    login_email = phone_login_email(body.phone)

    seen: set[str] = set()
    resolved: list[tuple[dict, str | None]] = []
    for choice in body.classes:
        if choice.batch in seen:
            raise HTTPException(status_code=422, detail="Each class can only be chosen once")
        seen.add(choice.batch)
        cls = _require_class(choice.batch)
        slot = _resolve_slot(cls, choice.batch_slot)
        resolved.append((cls, slot))

    generated = not (body.password and body.password.strip())
    password = body.password.strip() if not generated else secrets.token_urlsafe(9)
    if not generated and len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    # Create the auth user (email pre-confirmed so they can log in immediately).
    try:
        created = sb.auth.admin.create_user(
            {"email": login_email, "password": password, "email_confirm": True}
        )
        user = getattr(created, "user", None) or created
        user_id = user.id if hasattr(user, "id") else user["id"]
    except Exception as exc:  # noqa: BLE001 — surface a friendly duplicate message
        if "already" in str(exc).lower() or "registered" in str(exc).lower():
            raise HTTPException(status_code=409, detail="That phone number is already registered")
        raise HTTPException(status_code=400, detail="Could not create the account")

    join_date = body.join_date or now_local().date()
    first_cls, first_slot = resolved[0]
    row = {
        "id": user_id,
        "name": body.name.strip(),
        "email": None,
        "phone": phone,
        "batch": first_cls["id"],
        "batch_slot": first_slot,
        "join_date": join_date.isoformat(),
    }
    try:
        inserted = sb.table("students").insert(row).execute().data[0]
        for cls, slot in resolved:
            create_enrollment(user_id, cls["id"], slot, join_date.isoformat())
    except Exception:
        # Roll back the orphaned auth user (cascades to students + enrollments)
        # so a retry can reuse the phone.
        try:
            sb.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Could not save the student")

    detail = _build_student_detail(inserted)
    return AdminCreateStudentResponse(
        student=detail,
        temp_password=password if generated else None,
    )


@router.patch(
    "/students/{student_id}",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def update_student(student_id: str, body: AdminUpdateStudentRequest):
    """Edit a member's name and phone. Email is not editable here. Class
    membership is managed via the enrollment endpoints below."""
    sb = get_supabase()
    _load_student_or_404(student_id)

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    updates = {"name": body.name.strip(), "phone": phone}
    updated = sb.table("students").update(updates).eq("id", student_id).execute()
    return _build_student_detail(updated.data[0])


@router.post(
    "/students/{student_id}/enrollments",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def add_student_enrollment(student_id: str, body: AdminAddEnrollmentRequest):
    """Enroll a student into an additional class."""
    s = _load_student_or_404(student_id)
    cls = _require_class(body.batch)
    slot = _resolve_slot(cls, body.batch_slot)
    if get_enrollment(student_id, body.batch):
        raise HTTPException(status_code=409, detail="Already enrolled in this class")
    join_date = body.join_date or now_local().date()
    if join_date > now_local().date():
        raise HTTPException(status_code=422, detail="Join date can't be in the future")
    create_enrollment(student_id, cls["id"], slot, join_date.isoformat())
    return _build_student_detail(s)


@router.patch(
    "/students/{student_id}/enrollments/{class_id}",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def update_student_enrollment(student_id: str, class_id: str, body: AdminUpdateEnrollmentRequest):
    """Correct one class's timing or joining date."""
    s = _load_student_or_404(student_id)
    if not get_enrollment(student_id, class_id):
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    if body.join_date > now_local().date():
        raise HTTPException(status_code=422, detail="Join date can't be in the future")
    cls = get_class(class_id)
    slot = _resolve_slot(cls, body.batch_slot) if cls else (body.batch_slot or None)
    update_enrollment(
        student_id, class_id, {"batch_slot": slot, "join_date": body.join_date.isoformat()}
    )
    return _build_student_detail(s)


@router.delete(
    "/students/{student_id}/enrollments/{class_id}",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def remove_student_enrollment(student_id: str, class_id: str):
    """Remove one of a student's classes. A student always needs at least one —
    use "Remove student" to take them out entirely."""
    s = _load_student_or_404(student_id)
    if not get_enrollment(student_id, class_id):
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    if len(list_enrollments(student_id)) <= 1:
        raise HTTPException(
            status_code=400,
            detail="A student needs at least one class — add another before removing this one",
        )
    delete_enrollment(student_id, class_id)
    return _build_student_detail(s)


@router.post(
    "/students/{student_id}/mark-paid",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def mark_student_paid(student_id: str, body: MarkPaidRequest):
    """Record a cash payment for one class's month. Defaults to the current
    month and the full remaining balance; pass a period for an earlier month
    and/or amount_paise for a partial payment. A partial keeps the month unpaid
    until it's cleared. Idempotent for the full-payment case."""
    s = _load_student_or_404(student_id)
    enr = get_enrollment(student_id, body.batch)
    if not enr:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    join_date = _as_date(enr["join_date"])
    period = body.period or current_period()
    if period < period_of(join_date):
        raise HTTPException(status_code=400, detail="No fee was due before they joined")
    if period > current_period():
        raise HTTPException(status_code=400, detail="That month hasn't started yet")

    if is_period_waived(student_id, body.batch, period):
        raise HTTPException(
            status_code=400, detail="This month is waived — un-waive it first to record cash"
        )
    due = compute_due(_fee_cls(get_class(body.batch)), join_date, period)
    remaining = due.amount_paise - amount_paid_for(student_id, body.batch, period)
    if remaining > 0:
        # None → clear the whole remaining balance; a number → partial cash,
        # clamped so it can never exceed what's owed.
        requested = body.amount_paise if body.amount_paise is not None else remaining
        amount = max(1, min(requested, remaining))
        record_cash_payment(
            student_id, body.batch, period, amount, due.amount_paise, due.is_prorata, method=body.method
        )
    return _build_student_detail(s)


@router.post(
    "/students/{student_id}/waive",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def waive_student_period(student_id: str, body: PeriodActionRequest):
    """Forgive one class's month — e.g. dues that were charged by mistake (wrong
    join date, a month the studio decided not to bill). No money is recorded;
    the month simply stops showing as owed everywhere it's checked."""
    s = _load_student_or_404(student_id)
    enr = get_enrollment(student_id, body.batch)
    if not enr:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    join_date = _as_date(enr["join_date"])
    period = body.period or current_period()
    if period < period_of(join_date):
        raise HTTPException(status_code=400, detail="No fee was due before they joined")
    due = compute_due(_fee_cls(get_class(body.batch)), join_date, period)
    if is_settled(due.amount_paise, amount_paid_for(student_id, body.batch, period)):
        raise HTTPException(status_code=400, detail="This month is already paid — remove the payment first")
    waive_period(student_id, body.batch, period, due.amount_paise, due.is_prorata)
    return _build_student_detail(s)


@router.post(
    "/students/{student_id}/unwaive",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def unwaive_student_period(student_id: str, body: PeriodActionRequest):
    """Undo a waiver — the month goes back to owing its normal fee."""
    s = _load_student_or_404(student_id)
    if not get_enrollment(student_id, body.batch):
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    period = body.period or current_period()
    if not is_period_waived(student_id, body.batch, period):
        raise HTTPException(status_code=400, detail="This month isn't waived")
    delete_payment(student_id, body.batch, period)
    return _build_student_detail(s)


@router.post(
    "/students/{student_id}/remove-payment",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def remove_student_payment(student_id: str, body: PeriodActionRequest):
    """Reverse a mistakenly recorded payment — wrong month, a duplicate cash
    entry, or an online payment that needs undoing. The month goes back to
    unpaid as if nothing had been recorded."""
    s = _load_student_or_404(student_id)
    if not get_enrollment(student_id, body.batch):
        raise HTTPException(status_code=404, detail="Not enrolled in this class")
    period = body.period or current_period()
    if not delete_payment(student_id, body.batch, period):
        raise HTTPException(status_code=404, detail="No payment found for that month")
    return _build_student_detail(s)


@router.post(
    "/students/{student_id}/reset-password",
    response_model=AdminResetPasswordResponse,
    dependencies=[Depends(require_admin)],
)
def reset_student_password(student_id: str):
    """Set a fresh temporary password on the student's auth account and return it
    for the admin to share (e.g. over WhatsApp). Their previous password stops
    working immediately; the student can change it later from their profile."""
    _load_student_or_404(student_id)
    new_password = secrets.token_urlsafe(9)
    try:
        get_supabase().auth.admin.update_user_by_id(student_id, {"password": new_password})
    except Exception:  # noqa: BLE001 — surface a friendly failure
        raise HTTPException(status_code=400, detail="Could not reset the password")
    return AdminResetPasswordResponse(temp_password=new_password)


@router.delete("/students/{student_id}", dependencies=[Depends(require_admin)])
def delete_student(student_id: str):
    """Remove a student (and their enrollments + payments). Deletes the Supabase
    Auth user, which cascades to the students + enrollments + payments rows;
    falls back to a direct row delete if the auth user is already gone."""
    sb = get_supabase()
    _load_student_or_404(student_id)
    try:
        sb.auth.admin.delete_user(student_id)
    except Exception:
        sb.table("students").delete().eq("id", student_id).execute()
    return {"status": "deleted"}
