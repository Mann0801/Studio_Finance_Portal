"""Database operations for payments, shared by the payments router and webhook."""
from __future__ import annotations

from typing import Optional

from .db import get_supabase
from .fees import now_local


def upsert_created_order(
    student_id: str,
    period: str,
    amount_paise: int,
    is_prorata: bool,
    order_id: str,
) -> None:
    """Record (or refresh) the pending order for a (student, period).

    Uses the unique(student_id, period) constraint so retrying a payment for the
    same month overwrites the prior pending order rather than duplicating it.
    """
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "period": period,
            "amount_paise": amount_paise,
            "is_prorata": is_prorata,
            "status": "created",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": None,
            "paid_at": None,
        },
        on_conflict="student_id,period",
    ).execute()


def get_payment_by_order(order_id: str) -> Optional[dict]:
    res = (
        get_supabase()
        .table("payments")
        .select("*")
        .eq("razorpay_order_id", order_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def mark_paid(order_id: str, payment_id: str) -> bool:
    """Mark the order's payment row paid. Idempotent — returns True if a row was
    transitioned to (or already in) paid for this order."""
    sb = get_supabase()
    existing = get_payment_by_order(order_id)
    if not existing:
        return False
    if existing["status"] == "paid":
        return True
    sb.table("payments").update(
        {
            "status": "paid",
            "razorpay_payment_id": payment_id,
            "paid_at": now_local().isoformat(),
        }
    ).eq("razorpay_order_id", order_id).neq("status", "paid").execute()
    return True


def is_period_paid(student_id: str, period: str) -> bool:
    res = (
        get_supabase()
        .table("payments")
        .select("status")
        .eq("student_id", student_id)
        .eq("period", period)
        .eq("status", "paid")
        .limit(1)
        .execute()
    )
    return bool(res.data)
