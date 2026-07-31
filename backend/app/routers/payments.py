"""Payment routes: create a Razorpay order (locked, server-computed amount) and
verify the client checkout callback."""
from __future__ import annotations

from datetime import date as _date

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_student
from ..classes_store import get_class
from ..config import get_settings
from ..db import get_supabase
from ..fees import compute_due, current_period, period_of
from ..payments_store import (
    amount_paid_for,
    get_payment_by_order,
    is_period_paid,
    mark_paid,
    upsert_created_order,
)
from ..schemas import OrderRequest, OrderResponse, VerifyRequest
from ..services import razorpay_service

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _load_student(student_id: str) -> dict:
    res = get_supabase().table("students").select("*").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found; complete signup")
    return res.data[0]


@router.post("/order", response_model=OrderResponse)
def create_order(body: OrderRequest, student=Depends(get_current_student)):
    settings = get_settings()
    row = _load_student(student["id"])
    cls = get_class(row["batch"])
    if not cls or not cls.get("active", True):
        raise HTTPException(status_code=400, detail="Your class needs to be reassigned; contact the studio")
    if cls.get("fee_type") == "enquiry":
        raise HTTPException(status_code=400, detail="This class has no online payment; contact the studio")
    join_date = row["join_date"]
    if isinstance(join_date, str):
        join_date = _date.fromisoformat(join_date)

    period = body.period or current_period()
    if period < period_of(join_date):
        raise HTTPException(status_code=400, detail="No fee due before you joined")
    if is_period_paid(student["id"], period):
        raise HTTPException(status_code=409, detail="This month is already paid")

    due = compute_due(cls, join_date, period)
    if due.amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Nothing due for this period")

    # Charge only what's still owed: the full fee minus any partial cash the admin
    # already recorded for this month.
    already_paid = amount_paid_for(student["id"], period)
    remaining = due.amount_paise - already_paid
    if remaining <= 0:
        raise HTTPException(status_code=409, detail="This month is already paid")

    order = razorpay_service.create_order(
        amount_paise=remaining,
        receipt=f"{student['id'][:8]}-{period}",
        notes={"student_id": student["id"], "period": period},
    )
    upsert_created_order(
        student_id=student["id"],
        period=period,
        amount_paise=due.amount_paise,
        is_prorata=due.is_prorata,
        order_id=order["id"],
        paid_paise=already_paid,
    )

    return OrderResponse(
        key_id=settings.razorpay_key_id,
        order_id=order["id"],
        amount_paise=remaining,
        period=period,
        studio_name=settings.studio_name,
        prefill_name=row["name"],
        prefill_email=row.get("email") or "",  # phone-login students have no email
        prefill_contact=row["phone"],
    )


@router.post("/verify")
def verify(body: VerifyRequest, student=Depends(get_current_student)):
    """Verify the Razorpay checkout callback signature and mark the month paid.

    The order must belong to the authenticated student. The webhook is the
    authoritative backstop; this gives instant confirmation and works in local dev.
    """
    if not razorpay_service.verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    payment = get_payment_by_order(body.razorpay_order_id)
    if not payment or payment["student_id"] != student["id"]:
        raise HTTPException(status_code=404, detail="Order not found")

    mark_paid(body.razorpay_order_id, body.razorpay_payment_id)
    return {"status": "paid", "period": payment["period"]}
