"""Pydantic request/response models for the API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from .constants import Batch


class SignupRequest(BaseModel):
    # Account (email + password) is created on the frontend via Supabase Auth;
    # this call only attaches profile + batch to the authenticated user.
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: Batch


class StudentOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    batch: Batch
    batch_label: str
    join_date: date


class PaymentOut(BaseModel):
    period: str
    amount_paise: int
    is_prorata: bool
    status: str
    paid_at: Optional[datetime] = None


class CurrentDue(BaseModel):
    period: str
    amount_paise: int
    is_prorata: bool
    status: str  # 'paid' | 'unpaid'


class DashboardOut(BaseModel):
    student: StudentOut
    current: CurrentDue
    history: list[PaymentOut]
    attendance_this_month: int
