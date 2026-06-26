"""Admin routes: single hardcoded login, per-batch student lists, and stats."""
from __future__ import annotations

from datetime import date as _date

from fastapi import APIRouter, Depends, HTTPException

from ..auth import create_admin_token, require_admin, verify_admin_credentials
from ..constants import (
    BATCH_LABELS,
    TRADITIONAL_SLOTS,
    Batch,
    batch_info,
    slot_label,
)
from ..db import get_supabase
from ..fees import (
    compute_due,
    current_period,
    now_local,
    previous_period,
)
from ..payments_store import is_period_paid, mark_paid_cash
from ..schemas import (
    ActivityPayment,
    ActivitySignup,
    AdminActivity,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminPaymentRow,
    AdminStats,
    AdminStudentDetail,
    AdminStudentRow,
    BatchStat,
    SlotStat,
    StudentPaymentRow,
)
from ..services.whatsapp import reminder_link


def _payment_method(row: dict) -> str:
    """Cash payments have no Razorpay payment id; everything else is online."""
    return "Online" if row.get("razorpay_payment_id") else "Cash"

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _as_date(value) -> _date:
    return _date.fromisoformat(value) if isinstance(value, str) else value


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


@router.get(
    "/batches/{batch}",
    response_model=list[AdminStudentRow],
    dependencies=[Depends(require_admin)],
)
def list_batch(batch: Batch, slot: str | None = None):
    sb = get_supabase()
    period = current_period()
    students = (
        sb.table("students").select("*").eq("batch", batch.value).order("name").execute()
    ).data
    # Traditional Yoga is filtered down to a single timing slot when requested.
    if batch_info(batch).has_slots and slot:
        students = [s for s in students if s.get("batch_slot") == slot]
    paid = _paid_amounts_for_period(period, [s["id"] for s in students])

    rows: list[AdminStudentRow] = []
    for s in students:
        join_date = _as_date(s["join_date"])
        due = compute_due(batch, join_date, period)
        is_paid = s["id"] in paid
        amount = paid[s["id"]] if is_paid else due.amount_paise
        sl = slot_label(s.get("batch_slot"))
        wa = None
        if not is_paid and amount > 0:
            label = f"{BATCH_LABELS[batch]} ({sl})" if sl else BATCH_LABELS[batch]
            wa = reminder_link(s["phone"], s["name"], label, amount, period)
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s["email"],
                phone=s["phone"],
                batch=batch,
                batch_slot=s.get("batch_slot"),
                slot_label=sl,
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

    def _group_stat(batch: Batch, members: list[dict]):
        paid_ids = [s["id"] for s in members if s["id"] in paid]
        revenue = sum(paid[sid] for sid in paid_ids)
        # Expected = sum of what each enrolled student owes for this period
        # (0 for anyone who joined after this month).
        expected = sum(
            compute_due(batch, _as_date(s["join_date"]), period).amount_paise
            for s in members
        )
        return paid_ids, revenue, expected

    per_batch: list[BatchStat] = []
    total_paid = total_students = total_revenue = total_expected = 0
    for batch in Batch:
        members = [s for s in students if s["batch"] == batch.value]
        paid_ids, revenue, expected = _group_stat(batch, members)

        # Per-timing breakdown for batches with slots (Traditional Yoga).
        slots: list[SlotStat] = []
        if batch_info(batch).has_slots:
            for slot_key, slot_name in TRADITIONAL_SLOTS.items():
                smembers = [s for s in members if s.get("batch_slot") == slot_key]
                s_paid_ids, s_rev, s_exp = _group_stat(batch, smembers)
                slots.append(
                    SlotStat(
                        slot=slot_key,
                        slot_label=slot_name,
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
                batch=batch,
                batch_label=BATCH_LABELS[batch],
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
    """Every student who still owes this month, newest-joined last, each with a
    prefilled WhatsApp reminder link. Powers the admin "Send reminders" list."""
    sb = get_supabase()
    period = current_period()
    students = sb.table("students").select("*").order("name").execute().data
    paid = _paid_amounts_for_period(period, [s["id"] for s in students])

    rows: list[AdminStudentRow] = []
    for s in students:
        if s["id"] in paid:
            continue
        batch = Batch(s["batch"])
        due = compute_due(batch, _as_date(s["join_date"]), period)
        if due.amount_paise <= 0:
            continue
        sl = slot_label(s.get("batch_slot"))
        label = f"{BATCH_LABELS[batch]} ({sl})" if sl else BATCH_LABELS[batch]
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s["email"],
                phone=s["phone"],
                batch=batch,
                batch_slot=s.get("batch_slot"),
                slot_label=sl,
                join_date=_as_date(s["join_date"]),
                period=period,
                amount_paise=due.amount_paise,
                is_prorata=due.is_prorata,
                status="unpaid",
                whatsapp_url=reminder_link(
                    s["phone"], s["name"], label, due.amount_paise, period
                ),
            )
        )
    return rows


@router.get("/activity", response_model=AdminActivity, dependencies=[Depends(require_admin)])
def activity():
    """Home feed: the last 5 payments received and last 3 new signups."""
    sb = get_supabase()
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
        batch = Batch(s["batch"])
        recent_payments.append(
            ActivityPayment(
                name=s["name"],
                batch=batch,
                batch_label=BATCH_LABELS[batch],
                amount_paise=p["amount_paise"],
                paid_at=p.get("paid_at"),
            )
        )

    signups = (
        sb.table("students")
        .select("name, batch, join_date, created_at")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    ).data
    recent_signups = [
        ActivitySignup(
            name=s["name"],
            batch=Batch(s["batch"]),
            batch_label=BATCH_LABELS[Batch(s["batch"])],
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
    """All received payments, newest first (joined to student name + batch)."""
    sb = get_supabase()
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
        batch = Batch(s["batch"])
        rows.append(
            AdminPaymentRow(
                id=p["id"],
                name=s["name"],
                batch=batch,
                batch_label=BATCH_LABELS[batch],
                slot_label=slot_label(s.get("batch_slot")),
                amount_paise=p["amount_paise"],
                period=p["period"],
                paid_at=p.get("paid_at"),
                method=_payment_method(p),
            )
        )
    return rows


def _build_student_detail(s: dict) -> AdminStudentDetail:
    sb = get_supabase()
    batch = Batch(s["batch"])
    join_date = _as_date(s["join_date"])
    period = current_period()
    due = compute_due(batch, join_date, period)

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

    sl = slot_label(s.get("batch_slot"))
    wa = None
    if not this_paid and due.amount_paise > 0:
        label = f"{BATCH_LABELS[batch]} ({sl})" if sl else BATCH_LABELS[batch]
        wa = reminder_link(s["phone"], s["name"], label, due.amount_paise, period)

    return AdminStudentDetail(
        id=s["id"],
        name=s["name"],
        email=s.get("email"),
        phone=s["phone"],
        batch=batch,
        batch_label=BATCH_LABELS[batch],
        batch_slot=s.get("batch_slot"),
        slot_label=sl,
        join_date=join_date,
        days_member=max((now_local().date() - join_date).days, 0),
        period=period,
        amount_paise=this_paid["amount_paise"] if this_paid else due.amount_paise,
        is_prorata=due.is_prorata,
        status="paid" if this_paid else "unpaid",
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


@router.get(
    "/students/{student_id}",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def student_detail(student_id: str):
    return _build_student_detail(_load_student_or_404(student_id))


@router.post(
    "/students/{student_id}/mark-paid",
    response_model=AdminStudentDetail,
    dependencies=[Depends(require_admin)],
)
def mark_student_paid(student_id: str):
    """Manually mark this month paid (e.g. the student paid cash). Idempotent."""
    s = _load_student_or_404(student_id)
    period = current_period()
    if not is_period_paid(student_id, period):
        due = compute_due(Batch(s["batch"]), _as_date(s["join_date"]), period)
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
