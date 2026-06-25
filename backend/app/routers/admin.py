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
from ..fees import compute_due, current_period, previous_period
from ..schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminStats,
    AdminStudentRow,
    BatchStat,
    SlotStat,
)
from ..services.whatsapp import reminder_link

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
