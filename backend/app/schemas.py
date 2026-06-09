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


# ── Admin ──
class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str


class AdminStudentRow(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    batch: Batch
    join_date: date
    period: str
    amount_paise: int
    is_prorata: bool
    status: str  # 'paid' | 'unpaid'
    whatsapp_url: Optional[str] = None  # present only for unpaid students


class BatchStat(BaseModel):
    batch: Batch
    batch_label: str
    total_students: int
    paid_count: int
    unpaid_count: int
    revenue_paise: int        # actual collected this period
    expected_paise: int       # sum of dues for enrolled students
    collection_rate: float    # 0–100, actual / expected


class AdminStats(BaseModel):
    period: str
    total_students: int
    paid_count: int
    unpaid_count: int
    revenue_paise: int                  # actual collected this period
    expected_paise: int                 # sum of dues across all students
    collection_rate: float              # 0–100
    last_month_revenue_paise: int
    revenue_change_pct: float           # % change vs last month's collection
    attendance_this_month: int
    per_batch: list[BatchStat]


# ── Announcements ──
class AnnouncementIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class AnnouncementOut(BaseModel):
    id: str
    message: str
    created_at: datetime
