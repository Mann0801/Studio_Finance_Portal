"""Razorpay webhook — authoritative server-to-server payment confirmation.

Configure in the Razorpay dashboard with the URL
``https://<your-backend>/api/webhooks/razorpay`` and the ``payment.captured``
(and optionally ``order.paid``) events, using RAZORPAY_WEBHOOK_SECRET.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request

from ..payments_store import mark_paid
from ..services import razorpay_service

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _extract_order_and_payment(event: dict) -> tuple[str | None, str | None]:
    """Pull (order_id, payment_id) from a payment.captured or order.paid event."""
    payload = event.get("payload", {})
    entity = payload.get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not order_id:
        order_id = payload.get("order", {}).get("entity", {}).get("id")
    return order_id, payment_id


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
):
    body = await request.body()
    if not razorpay_service.verify_webhook_signature(body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = await request.json()
    if event.get("event") not in ("payment.captured", "order.paid"):
        return {"status": "ignored"}

    order_id, payment_id = _extract_order_and_payment(event)
    if not order_id:
        return {"status": "ignored"}

    mark_paid(order_id, payment_id or "")
    return {"status": "ok"}
