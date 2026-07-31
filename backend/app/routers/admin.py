"""Admin routes: single hardcoded login, dynamic class CRUD, per-class student
lists, and stats."""
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
    student_count,
    student_counts,
    unique_slug,
    update_class,
)
from ..constants import ENQUIRY, FEE_TYPES, SESSION_PACK
from ..db import get_supabase
from ..fees import compute_due, current_period, now_local, period_of, previous_period
from ..payments_store import is_period_paid, mark_paid_cash
from ..schemas import (
    ActivityPayment,
    ActivitySignup,
    AdminActivity,
    AdminClassRow,
    AdminCreateStudentRequest,
    AdminCreateStudentResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminPaymentRow,
    AdminStats,
    AdminStudentDetail,
    AdminStudentRow,
    AdminUpdateStudentRequest,
    BatchStat,
    ClassDeleteResponse,
    ClassWriteRequest,
    CurrentDue,
    MarkPaidRequest,
    SlotStat,
    StudentPaymentRow,
)
from ..services.whatsapp import reminder_link
from ..util import normalize_phone, phone_login_email


def _payment_method(row: dict) -> str:
    """Cash payments have no Razorpay payment id; everything else is online."""
    return "Online" if row.get("razorpay_payment_id") else "Cash"


router = APIRouter(prefix="/api/admin", tags=["admin"])


def _as_date(value) -> _date:
    return _date.fromisoformat(value) if isinstance(value, str) else value


def _deleted(cls: dict | None) -> bool:
    """A student's class is 'deleted' when its row is gone or soft-deleted."""
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


def _paid_amounts_for_period(period: str, student_ids: list[str] | None = None) -> dict[str, int]:
    """Map student_id -> paid amount_paise for `period` (only 'paid' rows)."""
    q = (
        get_supabase()
        .table("payments")
        .select("student_id, amount_paise")
        .eq("period", period)
        .eq("status", "paid")
    )
    if student_ids is not None:
        if not student_ids:
            return {}
        q = q.in_("student_id", student_ids)
    return {r["student_id"]: r["amount_paise"] for r in q.execute().data}


def _collection_rate(actual: int, expected: int) -> float:
    """Actual / expected as a 0–100 percentage, rounded to 1 dp."""
    if expected <= 0:
        return 0.0
    return round(actual / expected * 100, 1)


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
    """Every class (active + soft-deleted) with its student count. Counts come
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
@router.get(
    "/batches/{batch}",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def list_batch(batch: str, slot: str | None = None):
    sb = get_supabase()
    period = current_period()
    cls = get_class(batch)
    deleted = _deleted(cls)
    students = (
        sb.table("students").select("*").eq("batch", batch).order("name").execute()
    ).data
    # Classes with timing slots can be filtered to a single slot.
    if cls and cls.get("slots") and slot:
        students = [s for s in students if s.get("batch_slot") == slot]
    paid = _paid_amounts_for_period(period, [s["id"] for s in students])

    rows: list[AdminStudentRow] = []
    for s in students:
        join_date = _as_date(s["join_date"])
        due = compute_due(_fee_cls(cls), join_date, period)
        is_paid = s["id"] in paid
        amount = paid[s["id"]] if is_paid else due.amount_paise
        sl = slot_label_of(cls, s.get("batch_slot"))
        wa = None
        if not is_paid and amount > 0:
            wa = reminder_link(s["phone"], s["name"], _reminder_label(cls, sl), amount, period)
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s.get("email"),
                phone=s["phone"],
                batch=batch,
                batch_label=class_label(cls),
                batch_slot=s.get("batch_slot"),
                slot_label=sl,
                batch_deleted=deleted,
                join_date=join_date,
                period=period,
                amount_paise=amount,
                is_prorata=due.is_prorata,
                status="paid" if is_paid else "unpaid",
                whatsapp_url=wa,
            )
        )
    return rows


@router.get("/stats", response_model=AdminStats, dependencies=[Depends(require_admin)])
def stats():
    sb = get_supabase()
    period = current_period()
    prev = previous_period(period)
    students = sb.table("students").select("id, batch, batch_slot, join_date").execute().data
    paid = _paid_amounts_for_period(period)
    last_month_paid = _paid_amounts_for_period(prev)
    classes = list_classes()

    def _group_stat(fee_cls: dict | None, members: list[dict]):
        paid_ids = [s["id"] for s in members if s["id"] in paid]
        revenue = sum(paid[sid] for sid in paid_ids)
        expected = sum(
            compute_due(fee_cls, _as_date(s["join_date"]), period).amount_paise
            for s in members
        )
        return paid_ids, revenue, expected

    per_batch: list[BatchStat] = []
    total_paid = total_students = total_revenue = total_expected = 0
    for cls in classes:
        members = [s for s in students if s["batch"] == cls["id"]]
        # Soft-deleted classes only stay visible while they still hold students
        # (so the admin can reassign them); hide empty removed classes.
        if not cls.get("active", True) and not members:
            continue
        fee_cls = _fee_cls(cls)
        paid_ids, revenue, expected = _group_stat(fee_cls, members)

        # Per-timing breakdown for classes that have slots.
        slots: list[SlotStat] = []
        for slot in cls.get("slots") or []:
            smembers = [s for s in members if s.get("batch_slot") == slot["key"]]
            s_paid_ids, s_rev, s_exp = _group_stat(fee_cls, smembers)
            slots.append(
                SlotStat(
                    slot=slot["key"],
                    slot_label=slot_label_of(cls, slot["key"]) or slot.get("name", ""),
                    total_students=len(smembers),
                    paid_count=len(s_paid_ids),
                    unpaid_count=len(smembers) - len(s_paid_ids),
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
                paid_count=len(paid_ids),
                unpaid_count=len(members) - len(paid_ids),
                revenue_paise=revenue,
                expected_paise=expected,
                collection_rate=_collection_rate(revenue, expected),
                slots=slots,
            )
        )
        total_students += len(members)
        total_paid += len(paid_ids)
        total_revenue += revenue
        total_expected += expected

    last_month_revenue = sum(last_month_paid.values())
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


def _students_by_id(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    rows = (
        get_supabase()
        .table("students")
        .select("id, name, batch, batch_slot")
        .in_("id", list(set(ids)))
        .execute()
        .data
    )
    return {s["id"]: s for s in rows}


@router.get(
    "/unpaid",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def unpaid_students():
    """Every student who still owes this month, each with a prefilled WhatsApp
    reminder link. Powers the admin "Send reminders" list."""
    sb = get_supabase()
    period = current_period()
    cmap = class_map()
    students = sb.table("students").select("*").order("name").execute().data
    paid = _paid_amounts_for_period(period, [s["id"] for s in students])

    rows: list[AdminStudentRow] = []
    for s in students:
        if s["id"] in paid:
            continue
        cls = cmap.get(s["batch"])
        due = compute_due(_fee_cls(cls), _as_date(s["join_date"]), period)
        if due.amount_paise <= 0:
            continue
        sl = slot_label_of(cls, s.get("batch_slot"))
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s.get("email"),
                phone=s["phone"],
                batch=s["batch"],
                batch_label=class_label(cls),
                batch_slot=s.get("batch_slot"),
                slot_label=sl,
                batch_deleted=_deleted(cls),
                join_date=_as_date(s["join_date"]),
                period=period,
                amount_paise=due.amount_paise,
                is_prorata=due.is_prorata,
                status="unpaid",
                whatsapp_url=reminder_link(
                    s["phone"], s["name"], _reminder_label(cls, sl), due.amount_paise, period
                ),
            )
        )
    return rows


@router.get("/activity", response_model=AdminActivity, dependencies=[Depends(require_admin)])
def activity():
    """Home feed: recent new signups (shown in a fixed-height scroll widget).
    recent_payments is still returned for API compatibility."""
    sb = get_supabase()
    cmap = class_map()
    pays = (
        sb.table("payments")
        .select("student_id, amount_paise, paid_at")
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
        cls = cmap.get(s["batch"])
        recent_payments.append(
            ActivityPayment(
                name=s["name"],
                batch=s["batch"],
                batch_label=class_label(cls),
                amount_paise=p["amount_paise"],
                paid_at=p.get("paid_at"),
            )
        )

    signups = (
        sb.table("students")
        .select("name, batch, join_date, created_at")
        .order("created_at", desc=True)
        .limit(15)
        .execute()
    ).data
    recent_signups = [
        ActivitySignup(
            name=s["name"],
            batch=s["batch"],
            batch_label=class_label(cmap.get(s["batch"])),
            join_date=_as_date(s["join_date"]),
        )
        for s in signups
    ]

    return AdminActivity(recent_payments=recent_payments, recent_signups=recent_signups)


@router.get(
    "/payments",
    response_model=list[AdminPaymentRow],
    dependencies=[Depends(require_admin)],
)
def payment_history(limit: int = 100):
    """All received payments, newest first (joined to student name + class)."""
    sb = get_supabase()
    cmap = class_map()
    pays = (
        sb.table("payments")
        .select("id, student_id, amount_paise, period, paid_at, razorpay_payment_id")
        .eq("status", "paid")
        .order("paid_at", desc=True)
        .limit(limit)
        .execute()
    ).data
    smap = _students_by_id([p["student_id"] for p in pays])

    rows: list[AdminPaymentRow] = []
    for p in pays:
        s = smap.get(p["student_id"])
        if not s:
            continue
        cls = cmap.get(s["batch"])
        rows.append(
            AdminPaymentRow(
                id=p["id"],
                name=s["name"],
                batch=s["batch"],
                batch_label=class_label(cls),
                slot_label=slot_label_of(cls, s.get("batch_slot")),
                amount_paise=p["amount_paise"],
                period=p["period"],
                paid_at=p.get("paid_at"),
                method=_payment_method(p),
            )
        )
    return rows


def _build_student_detail(s: dict) -> AdminStudentDetail:
    sb = get_supabase()
    cls = get_class(s["batch"])
    deleted = _deleted(cls)
    join_date = _as_date(s["join_date"])
    period = current_period()
    due = compute_due(_fee_cls(cls), join_date, period)

    pays = (
        sb.table("payments")
        .select("period, amount_paise, paid_at, status, razorpay_payment_id")
        .eq("student_id", s["id"])
        .order("period", desc=True)
        .execute()
    ).data
    paid_rows = [p for p in pays if p["status"] == "paid"]
    total_paid = sum(p["amount_paise"] for p in paid_rows)
    last = max(paid_rows, key=lambda p: p.get("paid_at") or "", default=None)
    this_paid = next((p for p in paid_rows if p["period"] == period), None)

    # Earlier months (join month .. last month) still owed — so the admin can
    # record cash against an old unpaid month, not just the current one.
    paid_periods = {p["period"] for p in paid_rows}
    join_period = period_of(join_date)
    outstanding: list[CurrentDue] = []
    p = previous_period(period)
    while p >= join_period:
        if p not in paid_periods:
            past_due = compute_due(_fee_cls(cls), join_date, p)
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
        StudentPaymentRow(
            period=p["period"],
            amount_paise=p["amount_paise"],
            paid_at=p.get("paid_at"),
            method=_payment_method(p),
            status=p["status"],
        )
        for p in pays
    ]

    sl = slot_label_of(cls, s.get("batch_slot"))
    wa = None
    if not this_paid and due.amount_paise > 0:
        wa = reminder_link(s["phone"], s["name"], _reminder_label(cls, sl), due.amount_paise, period)

    return AdminStudentDetail(
        id=s["id"],
        name=s["name"],
        email=s.get("email"),
        phone=s["phone"],
        batch=s["batch"],
        batch_label=class_label(cls),
        fee_type=cls.get("fee_type") if cls else None,
        batch_slot=s.get("batch_slot"),
        slot_label=sl,
        batch_deleted=deleted,
        join_date=join_date,
        signed_up_at=s.get("created_at"),
        days_member=max((now_local().date() - join_date).days, 0),
        period=period,
        amount_paise=this_paid["amount_paise"] if this_paid else due.amount_paise,
        is_prorata=due.is_prorata,
        status="paid" if this_paid else "unpaid",
        outstanding=outstanding,
        total_paid_paise=total_paid,
        last_payment_paise=last["amount_paise"] if last else None,
        last_payment_at=last.get("paid_at") if last else None,
        payments=history,
        whatsapp_url=wa,
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
    plus the matching students row. If no password is given, a temporary one is
    generated and returned for the admin to share."""
    sb = get_supabase()

    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid phone number")

    # Phone is the login identity (via a synthetic auth email — must match the
    # frontend's phoneToEmail so the same phone always resolves to this account).
    login_email = phone_login_email(body.phone)

    cls = _require_class(body.batch)
    slot = _resolve_slot(cls, body.batch_slot)

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
    row = {
        "id": user_id,
        "name": body.name.strip(),
        "email": None,
        "phone": phone,
        "batch": cls["id"],
        "batch_slot": slot,
        "join_date": join_date.isoformat(),
    }
    try:
        inserted = sb.table("students").insert(row).execute()
    except Exception:
        # Roll back the orphaned auth user so a retry can reuse the phone.
        try:
            sb.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Could not save the student")

    detail = _build_student_detail(inserted.data[0])
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
    """Edit a member's name, phone and class/timing. Email is not editable here.
    Also used to reassign students out of a deleted class."""
    sb = get_supabase()
    _load_student_or_404(student_id)

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
    updated = sb.table("students").update(updates).eq("id", student_id).execute()
    return _build_student_detail(updated.data[0])


@router.post(
    "/students/{student_id}/mark-paid",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def mark_student_paid(student_id: str, body: MarkPaidRequest | None = None):
    """Manually mark a month paid (e.g. the student paid cash). Defaults to the
    current month; pass a period to clear an earlier unpaid month. Idempotent."""
    s = _load_student_or_404(student_id)
    join_date = _as_date(s["join_date"])
    period = (body.period if body else None) or current_period()
    if period < period_of(join_date):
        raise HTTPException(status_code=400, detail="No fee was due before they joined")
    if period > current_period():
        raise HTTPException(status_code=400, detail="That month hasn't started yet")
    if not is_period_paid(student_id, period):
        due = compute_due(_fee_cls(get_class(s["batch"])), join_date, period)
        if due.amount_paise > 0:
            mark_paid_cash(student_id, period, due.amount_paise, due.is_prorata)
    return _build_student_detail(s)


@router.delete("/students/{student_id}", dependencies=[Depends(require_admin)])
def delete_student(student_id: str):
    """Remove a student (and their payments). Deletes the Supabase Auth user,
    which cascades to the students + payments rows; falls back to a direct row
    delete if the auth user is already gone."""
    sb = get_supabase()
    _load_student_or_404(student_id)
    try:
        sb.auth.admin.delete_user(student_id)
    except Exception:
        sb.table("students").delete().eq("id", student_id).execute()
    return {"status": "deleted"}
