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


class OrderRequest(BaseModel):
    # Optional; defaults to the current calendar month. The amount is NEVER taken
    # from the client — the server computes it from batch + join date + period.
    period: Optional[str] = None


class OrderResponse(BaseModel):
    key_id: str           # Razorpay public key id, for the checkout widget
    order_id: str
    amount_paise: int
    currency: str = "INR"
    period: str
    studio_name: str
    prefill_name: str
    prefill_email: str
    prefill_contact: str


class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
