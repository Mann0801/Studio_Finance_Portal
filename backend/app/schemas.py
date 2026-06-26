"""Pydantic request/response models for the API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from .constants import Batch


class SignupRequest(BaseModel):
    # The account (identity + password) is created on the frontend via Supabase
    # Auth after OTP verification; this call attaches the profile to the verified
    # user: display name, a unique username, phone and chosen batch.
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=30)
    phone: str = Field(min_length=6, max_length=20)
    batch: Batch
    batch_slot: Optional[str] = None  # timing slot key, required for Traditional Yoga


class UpdateProfileRequest(BaseModel):
    # Self-service profile edit from the student Profile tab. Username and email
    # (the login identity) are not editable here; only display/contact details and
    # the chosen batch + timing slot.
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: Batch
    batch_slot: Optional[str] = None  # timing slot key, required for Traditional Yoga


class StudentOut(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: str
    batch: Batch
    batch_label: str
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    join_date: date


# ── Auth (username + password login, username availability) ──
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1)


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str


class UsernameAvailability(BaseModel):
    available: bool
    reason: Optional[str] = None


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
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    join_date: date
    period: str
    amount_paise: int
    is_prorata: bool
    status: str  # 'paid' | 'unpaid'
    whatsapp_url: Optional[str] = None  # present only for unpaid students


class SlotStat(BaseModel):
    slot: str
    slot_label: str
    total_students: int
    paid_count: int
    unpaid_count: int
    revenue_paise: int
    expected_paise: int
    collection_rate: float    # 0–100, actual / expected


class BatchStat(BaseModel):
    batch: Batch
    batch_label: str
    total_students: int
    paid_count: int
    unpaid_count: int
    revenue_paise: int        # actual collected this period
    expected_paise: int       # sum of dues for enrolled students
    collection_rate: float    # 0–100, actual / expected
    slots: list[SlotStat] = []  # per-timing breakdown (Traditional Yoga only)


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
    per_batch: list[BatchStat]


# ── Admin: activity feed + payment history ──
class ActivityPayment(BaseModel):
    name: str
    batch: Batch
    batch_label: str
    amount_paise: int
    paid_at: Optional[datetime] = None


class ActivitySignup(BaseModel):
    name: str
    batch: Batch
    batch_label: str
    join_date: date


class AdminActivity(BaseModel):
    recent_payments: list[ActivityPayment]
    recent_signups: list[ActivitySignup]


class AdminPaymentRow(BaseModel):
    id: str
    name: str
    batch: Batch
    batch_label: str
    slot_label: Optional[str] = None
    amount_paise: int
    period: str
    paid_at: Optional[datetime] = None
    method: str = "Online"  # the gateway instrument isn't stored; generic label


class StudentPaymentRow(BaseModel):
    period: str
    amount_paise: int
    paid_at: Optional[datetime] = None
    method: str = "Online"
    status: str  # 'created' | 'paid' | 'failed'


class AdminStudentDetail(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: str
    batch: Batch
    batch_label: str
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    join_date: date
    days_member: int
    # This month
    period: str
    amount_paise: int          # paid amount if paid, else the due amount
    is_prorata: bool
    status: str                # 'paid' | 'unpaid'
    # Lifetime
    total_paid_paise: int
    last_payment_paise: Optional[int] = None
    last_payment_at: Optional[datetime] = None
    payments: list[StudentPaymentRow]
    # Attendance: classes scheduled this month (attendance itself isn't tracked)
    classes_this_month: int
    whatsapp_url: Optional[str] = None


# ── Announcements ──
class AnnouncementIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class AnnouncementOut(BaseModel):
    id: str
    message: str
    created_at: datetime
