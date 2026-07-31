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
    paid_paise: int = 0,
) -> None:
    """Record (or refresh) the pending order for a (student, period).

    Uses the unique(student_id, period) constraint so retrying a payment for the
    same month overwrites the prior pending order rather than duplicating it.
    ``amount_paise`` is the full month fee; ``paid_paise`` preserves any partial
    cash already recorded so the online order only needs to cover the remainder.
    """
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "period": period,
            "amount_paise": amount_paise,
            "paid_paise": paid_paise,
            "is_prorata": is_prorata,
            "status": "created",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": None,
            "paid_at": None,
        },
        on_conflict="student_id,period",
    ).execute()


def get_payment_by_period(student_id: str, period: str) -> Optional[dict]:
    res = (
        get_supabase()
        .table("payments")
        .select("*")
        .eq("student_id", student_id)
        .eq("period", period)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def amount_paid_for(student_id: str, period: str) -> int:
    """Cash/online paise recorded toward a month so far (0 if nothing yet)."""
    row = get_payment_by_period(student_id, period)
    return (row.get("paid_paise") or 0) if row else 0


def record_cash_payment(
    student_id: str, period: str, amount_now_paise: int, due_paise: int, is_prorata: bool
) -> None:
    """Add a cash amount toward a (student, period). Accumulates on top of anything
    already paid; the month flips to 'paid' only once the full fee is covered.
    No Razorpay payment id — that's how cash is distinguished from an online payment."""
    prev = amount_paid_for(student_id, period)
    new_paid = min(prev + max(amount_now_paise, 0), due_paise)
    fully = new_paid >= due_paise
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "period": period,
            "amount_paise": due_paise,
            "paid_paise": new_paid,
            "is_prorata": is_prorata,
            "status": "paid" if fully else "created",
            "razorpay_order_id": f"cash-{student_id[:8]}-{period}",
            "razorpay_payment_id": None,
            # Stamp the time cash was last received (even for a partial) so it
            # shows dated in the payment history.
            "paid_at": now_local().isoformat(),
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
    # An online payment covers the remaining balance, so the month is now fully
    # settled — bring paid_paise up to the full fee.
    sb.table("payments").update(
        {
            "status": "paid",
            "paid_paise": existing["amount_paise"],
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
