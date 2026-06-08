from app.routers.webhooks import _extract_order_and_payment
from app.services import razorpay_service


def test_extract_from_payment_captured():
    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {"entity": {"id": "pay_123", "order_id": "order_abc"}}
        },
    }
    assert _extract_order_and_payment(event) == ("order_abc", "pay_123")


def test_extract_from_order_paid_without_payment_entity():
    event = {
        "event": "order.paid",
        "payload": {"order": {"entity": {"id": "order_xyz"}}},
    }
    order_id, _ = _extract_order_and_payment(event)
    assert order_id == "order_xyz"


def test_extract_handles_empty_payload():
    assert _extract_order_and_payment({"event": "x", "payload": {}}) == (None, None)


def test_webhook_signature_fails_closed_without_secret(monkeypatch):
    # With no webhook secret configured, verification must fail (never silently pass).
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "")
    assert razorpay_service.verify_webhook_signature(b"{}", "sig") is False
    get_settings.cache_clear()
