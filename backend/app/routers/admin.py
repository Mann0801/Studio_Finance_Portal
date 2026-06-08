"""Admin routes: single hardcoded login, per-batch student lists, and stats."""
from __future__ import annotations

from datetime import date as _date

from fastapi import APIRouter, Depends, HTTPException

from ..auth import create_admin_token, require_admin, verify_admin_credentials
from ..constants import BATCH_LABELS, Batch
from ..db import get_supabase
from ..fees import compute_due, current_period, month_range
from ..schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminStats,
    AdminStudentRow,
    BatchStat,
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
def list_batch(batch: Batch):
    sb = get_supabase()
    period = current_period()
    students = (
        sb.table("students").select("*").eq("batch", batch.value).order("name").execute()
    ).data
    paid = _paid_amounts_for_period(period, [s["id"] for s in students])

    rows: list[AdminStudentRow] = []
    for s in students:
        join_date = _as_date(s["join_date"])
        due = compute_due(batch, join_date, period)
        is_paid = s["id"] in paid
        amount = paid[s["id"]] if is_paid else due.amount_paise
        wa = None
        if not is_paid and amount > 0:
            wa = reminder_link(
                s["phone"], s["name"], BATCH_LABELS[batch], amount, period
            )
        rows.append(
            AdminStudentRow(
                id=s["id"],
                name=s["name"],
                email=s["email"],
                phone=s["phone"],
                batch=batch,
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
    students = sb.table("students").select("id, batch").execute().data
    paid = _paid_amounts_for_period(period)

    per_batch: list[BatchStat] = []
    total_paid = total_students = total_revenue = 0
    for batch in Batch:
        ids = [s["id"] for s in students if s["batch"] == batch.value]
        paid_ids = [sid for sid in ids if sid in paid]
        revenue = sum(paid[sid] for sid in paid_ids)
        per_batch.append(
            BatchStat(
                batch=batch,
                batch_label=BATCH_LABELS[batch],
                total_students=len(ids),
                paid_count=len(paid_ids),
                unpaid_count=len(ids) - len(paid_ids),
                revenue_paise=revenue,
            )
        )
        total_students += len(ids)
        total_paid += len(paid_ids)
        total_revenue += revenue

    start, end = month_range(period)
    att = (
        sb.table("attendance")
        .select("id", count="exact")
        .gte("date", start)
        .lt("date", end)
        .execute()
    )

    return AdminStats(
        period=period,
        total_students=total_students,
        paid_count=total_paid,
        unpaid_count=total_students - total_paid,
        revenue_paise=total_revenue,
        attendance_this_month=att.count or 0,
        per_batch=per_batch,
    )
