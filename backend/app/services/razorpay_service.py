"""Razorpay integration: order creation and signature verification.

Two independent paths confirm a payment, both idempotent:
  1. Client callback (``verify_payment_signature``) — instant UX after checkout,
     and the only path that works in local dev where Razorpay can't reach
     localhost with a webhook.
  2. Webhook (``verify_webhook_signature``) — the authoritative server-to-server
     backstop in production.
"""
from __future__ import annotations

from functools import lru_cache

import razorpay

from ..config import get_settings


@lru_cache
def get_client() -> razorpay.Client:
    settings = get_settings()
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError(
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set; fill them into "
            "backend/.env (use rzp_test_* keys for development)."
        )
    return razorpay.Client(
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret)
    )


def create_order(amount_paise: int, receipt: str, notes: dict) -> dict:
    """Create a Razorpay order for the (server-computed) amount in paise."""
    return get_client().order.create(
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": notes,
            "payment_capture": 1,
        }
    )


def verify_payment_signature(
    order_id: str, payment_id: str, signature: str
) -> bool:
    """Verify the client checkout callback signature. Returns True if valid."""
    try:
        get_client().utility.verify_payment_signature(
            {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            }
        )
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify a Razorpay webhook payload signature against the webhook secret."""
    settings = get_settings()
    if not settings.razorpay_webhook_secret:
        return False
    try:
        get_client().utility.verify_webhook_signature(
            body.decode("utf-8"), signature, settings.razorpay_webhook_secret
        )
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
