import pytest

from app.util import normalize_phone


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("9876543210", "919876543210"),       # bare 10-digit -> +91
        ("+91 98765 43210", "919876543210"),   # already has country code
        ("(987) 654-3210", "919876543210"),    # punctuation stripped
        ("919876543210", "919876543210"),       # untouched
    ],
)
def test_normalize_phone_ok(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "123", "abc", "1" * 20])
def test_normalize_phone_rejects_bad(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)
