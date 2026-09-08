"""Database operations for payments, shared by the payments router and webhook.

Every payment belongs to one (student, class) pair — a student in two classes
has two independent payment threads, never merged."""
from __future__ import annotations

from typing import Optional

from .db import get_supabase
from .fees import now_local


def payment_method_label(row: dict) -> str:
    """A manually-recorded payment's type/note (GPay, Cash, Netbanking, ...),
    falling back to Cash/Online for rows from before this was recorded."""
    if row.get("method"):
        return row["method"]
    return "Online" if row.get("razorpay_payment_id") else "Cash"


def _record_transaction(
    student_id: str,
    class_id: str,
    period: str,
    amount_paise: int,
    method: Optional[str],
    razorpay_payment_id: Optional[str],
    paid_at: str,
) -> None:
    """Log one individual money-in event to the payment_transactions ledger.
    ``payments`` stays the single source of truth for what's owed/settled this
    month; this table exists purely so a partial payment and its later
    remainder each keep their own date/method/amount instead of one
    overwriting the other — and so each gets its own receipt."""
    if amount_paise <= 0:
        return
    get_supabase().table("payment_transactions").insert(
        {
            "student_id": student_id,
            "class_id": class_id,
            "period": period,
            "amount_paise": amount_paise,
            "method": (method or "").strip() or None,
            "razorpay_payment_id": razorpay_payment_id,
            "paid_at": paid_at,
        }
    ).execute()


def build_history(payments: list[dict], transactions: list[dict]) -> list[dict]:
    """Merge a class's payment rows (due/status per month) with its individual
    transactions into one history list — one entry per real money-in event,
    not per month, so a partial payment and its remainder show (and can be
    receipted) separately. Shared by the student dashboard and admin views so
    both stay in sync.

    Each entry: id, period, amount_paise, paid_paise (both = this
    transaction's own amount), is_prorata (from the month's payments row),
    paid_at, method, status ('paid' — every transaction here is completed,
    real money received)."""
    due_by_period = {p["period"]: p for p in payments}
    by_period: dict[str, list[dict]] = {}
    for t in transactions:
        by_period.setdefault(t["period"], []).append(t)

    history: list[dict] = []
    for period, txns in by_period.items():
        due_row = due_by_period.get(period)
        is_prorata = bool(due_row["is_prorata"]) if due_row else False
        for t in txns:
            history.append(
                {
                    "id": t["id"],
                    "period": period,
                    "amount_paise": t["amount_paise"],
                    "paid_paise": t["amount_paise"],
                    "is_prorata": is_prorata,
                    "status": "paid",
                    "paid_at": t.get("paid_at"),
                    "method": payment_method_label(t),
                }
            )
    history.sort(key=lambda h: h["paid_at"] or "", reverse=True)
    return history


def list_transactions(student_id: str) -> list[dict]:
    """Every individual payment transaction for a student, across all their
    classes, newest first."""
    return (
        get_supabase()
        .table("payment_transactions")
        .select("*")
        .eq("student_id", student_id)
        .order("paid_at", desc=True)
        .execute()
    ).data


def upsert_created_order(
    student_id: str,
    class_id: str,
    period: str,
    amount_paise: int,
    is_prorata: bool,
    order_id: str,
    paid_paise: int = 0,
) -> None:
    """Record (or refresh) the pending order for a (student, class, period).

    Uses the unique(student_id, class_id, period) constraint so retrying a
    payment for the same month/class overwrites the prior pending order rather
    than duplicating it. ``amount_paise`` is the full month fee; ``paid_paise``
    preserves any partial cash already recorded so the online order only needs
    to cover the remainder.
    """
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "class_id": class_id,
            "period": period,
            "amount_paise": amount_paise,
            "paid_paise": paid_paise,
            "is_prorata": is_prorata,
            "status": "created",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": None,
            "paid_at": None,
        },
        on_conflict="student_id,class_id,period",
    ).execute()


def get_payment_by_period(student_id: str, class_id: str, period: str) -> Optional[dict]:
    res = (
        get_supabase()
        .table("payments")
        .select("*")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .eq("period", period)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def amount_paid_for(student_id: str, class_id: str, period: str) -> int:
    """Cash/online paise recorded toward a (student, class, period) so far (0 if
    nothing yet)."""
    row = get_payment_by_period(student_id, class_id, period)
    return (row.get("paid_paise") or 0) if row else 0


def record_cash_payment(
    student_id: str,
    class_id: str,
    period: str,
    amount_now_paise: int,
    due_paise: int,
    is_prorata: bool,
    method: Optional[str] = None,
) -> None:
    """Add a manually-recorded amount toward a (student, class, period) —
    cash, GPay, netbanking, or anything else paid outside the app. Accumulates
    on top of anything already paid; the month flips to 'paid' only once the
    full fee is covered. No Razorpay payment id — that's how a manual entry is
    distinguished from an online payment. ``method`` is a free-text label
    (e.g. "GPay") shown in payment history. ``amount_now_paise`` is also
    logged as its own row in payment_transactions — a partial payment and a
    later remainder each keep their own receipt instead of one overwriting
    the other."""
    prev = amount_paid_for(student_id, class_id, period)
    applied = max(min(amount_now_paise, due_paise - prev), 0)
    new_paid = prev + applied
    fully = new_paid >= due_paise
    paid_at = now_local().isoformat()
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "class_id": class_id,
            "period": period,
            "amount_paise": due_paise,
            "paid_paise": new_paid,
            "is_prorata": is_prorata,
            "status": "paid" if fully else "created",
            "razorpay_order_id": f"cash-{student_id[:8]}-{class_id}-{period}",
            "razorpay_payment_id": None,
            "method": (method or "").strip() or None,
            # Stamp the time cash was last received (even for a partial) so it
            # shows dated in the payment history.
            "paid_at": paid_at,
        },
        on_conflict="student_id,class_id,period",
    ).execute()
    _record_transaction(student_id, class_id, period, applied, method, None, paid_at)


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
    transitioned to (or already in) paid for this order. Order-scoped, so this
    already resolves the correct (student, class) pair without needing it passed
    in explicitly."""
    sb = get_supabase()
    existing = get_payment_by_order(order_id)
    if not existing:
        return False
    if existing["status"] == "paid":
        return True
    # An online payment covers the remaining balance, so the month is now fully
    # settled — bring paid_paise up to the full fee. Whatever gap this payment
    # actually closed (full fee minus any partial already recorded) is what
    # gets logged as its own transaction — the partial (if any) keeps its own
    # earlier entry rather than being folded into this one.
    covered = existing["amount_paise"] - (existing.get("paid_paise") or 0)
    paid_at = now_local().isoformat()
    res = (
        sb.table("payments")
        .update(
            {
                "status": "paid",
                "paid_paise": existing["amount_paise"],
                "razorpay_payment_id": payment_id,
                "paid_at": paid_at,
            }
        )
        .eq("razorpay_order_id", order_id)
        .neq("status", "paid")
        .execute()
    )
    # Both the browser's instant callback and Razorpay's webhook call this for
    # the same payment (by design — the webhook is the backstop if the
    # callback fails). The .neq() guard above means only whichever call wins
    # the race actually flips the row — res.data is empty for the loser, so
    # only the winner logs a transaction. Without this check both would log
    # one, double-counting the payment in history.
    if res.data:
        _record_transaction(
            existing["student_id"], existing["class_id"], existing["period"], covered, None, payment_id, paid_at
        )
    return True


def is_period_waived(student_id: str, class_id: str, period: str) -> bool:
    row = get_payment_by_period(student_id, class_id, period)
    return bool(row and row["status"] == "waived")


def waive_period(student_id: str, class_id: str, period: str, due_paise: int, is_prorata: bool) -> None:
    """Forgive a month's fee — e.g. dues that were charged by mistake, or a
    month the studio decides to waive. No money is recorded; the month simply
    stops showing as owed everywhere it's checked."""
    get_supabase().table("payments").upsert(
        {
            "student_id": student_id,
            "class_id": class_id,
            "period": period,
            "amount_paise": due_paise,
            "paid_paise": 0,
            "is_prorata": is_prorata,
            "status": "waived",
            "razorpay_order_id": f"waived-{student_id[:8]}-{class_id}-{period}",
            "razorpay_payment_id": None,
            "paid_at": None,
        },
        on_conflict="student_id,class_id,period",
    ).execute()


def delete_payment(student_id: str, class_id: str, period: str) -> bool:
    """Reverse a (student, class, period) payment entirely — a mistaken cash
    entry, a duplicate, or an un-waive. Returns True if a row existed to remove.
    The month goes back to however it would look with no payment at all. Also
    clears any transactions logged for that month (a waived month never has
    any, so this is a no-op there)."""
    sb = get_supabase()
    res = (
        sb.table("payments")
        .delete()
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .eq("period", period)
        .execute()
    )
    sb.table("payment_transactions").delete().eq("student_id", student_id).eq(
        "class_id", class_id
    ).eq("period", period).execute()
    return bool(res.data)


def move_payment(
    student_id: str,
    class_id: str,
    from_period: str,
    to_period: str,
    due_paise: int,
    is_prorata: bool,
) -> None:
    """Reassign a payment to a different month — e.g. an online payment came
    in for July when it was actually meant to cover September. The underlying
    transaction (Razorpay id, method, amount received, paid_at) is untouched;
    only which month it counts toward changes. amount_paise/status are
    recomputed against the new month's due, same as everywhere else."""
    row = get_payment_by_period(student_id, class_id, from_period)
    paid_paise = (row.get("paid_paise") or 0) if row else 0
    fully = due_paise > 0 and paid_paise >= due_paise
    sb = get_supabase()
    sb.table("payments").update(
        {
            "period": to_period,
            "amount_paise": due_paise,
            "is_prorata": is_prorata,
            "status": "paid" if fully else "created",
        }
    ).eq("student_id", student_id).eq("class_id", class_id).eq("period", from_period).execute()
    # Individual transactions move with it, so their receipts reflect the
    # corrected month too.
    sb.table("payment_transactions").update({"period": to_period}).eq(
        "student_id", student_id
    ).eq("class_id", class_id).eq("period", from_period).execute()
