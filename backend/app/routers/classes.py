"""Public class catalogue — read-only, powers the signup + Plans pages so they
reflect the admin's classes live (add/edit/delete all show up immediately)."""
from __future__ import annotations

from fastapi import APIRouter

from ..classes_store import list_classes
from ..schemas import ClassOut

router = APIRouter(prefix="/api", tags=["classes"])


@router.get("/classes", response_model=list[ClassOut])
def public_classes():
    """Active classes only, ordered by sort_order then name."""
    return [ClassOut(**c) for c in list_classes(active_only=True)]
