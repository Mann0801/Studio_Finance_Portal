from urllib.parse import parse_qs, urlparse

import jwt

from app.auth import create_admin_token
from app.config import get_settings
from app.services.whatsapp import reminder_link


def test_admin_token_roundtrip(monkeypatch):
    monkeypatch.setenv("ADMIN_JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    token = create_admin_token()
    payload = jwt.decode(token, "test-secret", algorithms=["HS256"])
    assert payload["role"] == "admin"
    get_settings.cache_clear()


def test_reminder_link_structure():
    url = reminder_link(
        phone="919876543210",
        name="Asha",
        batch_label="Yoga",
        amount_paise=2500_00,
        period="2026-06",
    )
    parsed = urlparse(url)
    assert parsed.netloc == "wa.me"
    assert parsed.path == "/919876543210"
    text = parse_qs(parsed.query)["text"][0]
    assert "Asha" in text
    assert "Yoga" in text
    assert "2,500" in text
    assert "June 2026" in text
