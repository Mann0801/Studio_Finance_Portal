"""Tests for the pause-range check — the part that decides whether a month is
frozen. Pure, no DB: `is_period_paused` just filters a list of already-fetched
rows, which is all it needs to be tested against."""
from app.pauses_store import is_period_paused


def test_period_inside_an_open_pause_is_paused():
    rows = [{"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": None}]
    assert is_period_paused(rows, "traditional_yoga", "2026-10") is True
    assert is_period_paused(rows, "traditional_yoga", "2026-12") is True  # still open -> covers the future too


def test_period_before_an_open_pause_is_not_paused():
    rows = [{"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": None}]
    assert is_period_paused(rows, "traditional_yoga", "2026-09") is False


def test_period_inside_a_closed_pause_is_paused():
    rows = [{"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": "2026-11"}]
    assert is_period_paused(rows, "traditional_yoga", "2026-10") is True
    assert is_period_paused(rows, "traditional_yoga", "2026-11") is True


def test_period_after_a_closed_pause_is_not_paused():
    # Confirms resuming doesn't retroactively re-bill later months by accident,
    # and doesn't stay frozen forever either.
    rows = [{"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": "2026-11"}]
    assert is_period_paused(rows, "traditional_yoga", "2026-12") is False


def test_a_different_classs_pause_does_not_bleed_over():
    rows = [{"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": None}]
    assert is_period_paused(rows, "gymnastics", "2026-10") is False


def test_multiple_pause_cycles_all_stay_protected():
    # A student who paused twice, resumed each time — both frozen windows must
    # stay frozen forever, even though a live boolean would only remember the
    # most recent one.
    rows = [
        {"class_id": "traditional_yoga", "from_period": "2026-06", "until_period": "2026-07"},
        {"class_id": "traditional_yoga", "from_period": "2026-10", "until_period": None},
    ]
    assert is_period_paused(rows, "traditional_yoga", "2026-06") is True
    assert is_period_paused(rows, "traditional_yoga", "2026-08") is False  # the gap between pauses bills normally
    assert is_period_paused(rows, "traditional_yoga", "2026-10") is True
