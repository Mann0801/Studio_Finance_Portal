"""Pydantic request/response models for the API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    # The account (email + password) is created on the frontend via Supabase Auth;
    # this call attaches the profile to the verified user: display name, phone and
    # chosen batch. Email is read server-side from the verified token.
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: str
    batch_slot: Optional[str] = None  # timing slot key, required for Traditional Yoga
    # The date the student actually started attending the studio (student-picked),
    # NOT the app signup date. Drives pro-rata; range-validated in the router.
    join_date: date


class UpdateProfileRequest(BaseModel):
    # Self-service profile edit from the student Profile tab. Username and email
    # (the login identity) are not editable here; only display/contact details and
    # the chosen batch + timing slot.
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: str
    batch_slot: Optional[str] = None  # timing slot key, required for Traditional Yoga


class StudentOut(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: str
    batch: str
    batch_label: str
    fee_type: Optional[str] = None       # class fee model ('enquiry' → contact card)
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    batch_deleted: bool = False          # true if the class was removed
    join_date: date
    whatsapp_joined: bool = False        # tapped "Join Group" at least once


class PaymentOut(BaseModel):
    period: str
    amount_paise: int          # full fee for the month
    is_prorata: bool
    status: str
    paid_at: Optional[datetime] = None
    paid_paise: int = 0        # amount actually received (partial or full)
    method: str = "Online"     # 'Cash' | 'Online'


class CurrentDue(BaseModel):
    period: str
    amount_paise: int          # remaining balance owed (full fee minus any partial)
    is_prorata: bool
    status: str  # 'paid' | 'unpaid'
    paid_paise: int = 0        # amount already paid toward this month (partial cash)


class DashboardOut(BaseModel):
    student: StudentOut
    current: CurrentDue
    # Unpaid months before the current one (join month up to last month), each
    # with its server-computed amount. Lets a student clear earlier dues.
    outstanding: list[CurrentDue] = []
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
    prefill_email: str = ""      # phone-login students have no email
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
    email: Optional[str] = None    # phone-login students have no email
    phone: str
    batch: str
    batch_label: str = ""
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    batch_deleted: bool = False
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
    batch: str
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
    batch: str
    batch_label: str
    amount_paise: int
    paid_at: Optional[datetime] = None


class ActivitySignup(BaseModel):
    name: str
    batch: str
    batch_label: str
    join_date: date


class AdminActivity(BaseModel):
    recent_payments: list[ActivityPayment]
    recent_signups: list[ActivitySignup]


class AdminPaymentRow(BaseModel):
    id: str
    name: str
    batch: str
    batch_label: str
    slot_label: Optional[str] = None
    amount_paise: int
    period: str
    paid_at: Optional[datetime] = None
    method: str = "Online"  # the gateway instrument isn't stored; generic label


class StudentPaymentRow(BaseModel):
    period: str
    amount_paise: int          # full fee for the month
    paid_at: Optional[datetime] = None
    method: str = "Online"
    status: str  # 'created' | 'paid' | 'failed'
    paid_paise: int = 0        # amount actually received (partial or full)


class AdminStudentDetail(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: str
    batch: str
    batch_label: str
    fee_type: Optional[str] = None
    batch_slot: Optional[str] = None
    slot_label: Optional[str] = None
    batch_deleted: bool = False
    join_date: date              # studio joining date (student-picked) — "Joined Studio"
    signed_up_at: Optional[datetime] = None  # app account creation — "App Signup Date"
    days_member: int
    # This month
    period: str
    amount_paise: int          # paid amount if paid, else the remaining balance
    is_prorata: bool
    status: str                # 'paid' | 'unpaid'
    paid_paise: int = 0        # amount already paid toward this month (partial cash)
    # Lifetime
    # Unpaid months before the current one (join month up to last month), each
    # with its server-computed amount — lets the admin record cash for old dues.
    outstanding: list[CurrentDue] = []
    total_paid_paise: int
    last_payment_paise: Optional[int] = None
    last_payment_at: Optional[datetime] = None
    payments: list[StudentPaymentRow]
    whatsapp_url: Optional[str] = None


class MarkPaidRequest(BaseModel):
    # Which month to record as cash-paid; defaults to the current calendar month.
    period: Optional[str] = None
    # Cash amount received (paise). None = the full remaining balance. A smaller
    # amount is recorded as a partial payment; the month stays unpaid until cleared.
    amount_paise: Optional[int] = Field(default=None, ge=1)


class AdminCreateStudentRequest(BaseModel):
    # Admin registers a walk-in. Phone is the login identity; a password is set so
    # the member can sign in later (auto-generated and returned if left blank).
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: str
    batch_slot: Optional[str] = None
    join_date: Optional[date] = None  # defaults to today
    password: Optional[str] = Field(default=None, max_length=72)


class AdminUpdateStudentRequest(BaseModel):
    # Admin fixes a member's details. Email (the login identity) is not editable.
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    batch: str
    batch_slot: Optional[str] = None
    # Studio joining date. Editing it re-computes pro-rata for every unpaid month
    # live (already-paid months keep their recorded amount). Admin can set any
    # past date; only the future is rejected in the route.
    join_date: Optional[date] = None


class AdminCreateStudentResponse(BaseModel):
    student: AdminStudentDetail
    # The temporary password to share, present only when it was auto-generated.
    temp_password: Optional[str] = None


# ── Announcements ──
class AnnouncementIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class AnnouncementOut(BaseModel):
    id: str
    message: str
    created_at: datetime


class AdminAnnouncementRow(AnnouncementOut):
    active: bool = False  # true = currently shown as the student banner


# ── Classes (dynamic catalogue) ──
class ClassSlot(BaseModel):
    key: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=60)
    start: Optional[str] = None
    end: Optional[str] = None


class ClassOut(BaseModel):
    """Public class shape (signup / Plans page)."""
    id: str
    name: str
    fee_type: str
    fee_paise: int
    sessions_per_month: Optional[int] = None
    schedule_days: list[int] = []
    slots: list[ClassSlot] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None
    whatsapp_group_url: Optional[str] = None   # class WhatsApp group invite


class AdminClassRow(ClassOut):
    active: bool = True
    student_count: int = 0


class WhatsAppLinkRequest(BaseModel):
    # Admin sets/switches a class's WhatsApp group invite. Empty/blank clears it.
    whatsapp_group_url: Optional[str] = Field(default=None, max_length=300)


class ClassWriteRequest(BaseModel):
    """Create/update body for a class."""
    name: str = Field(min_length=1, max_length=120)
    fee_type: str
    fee_paise: int = Field(default=0, ge=0)
    sessions_per_month: Optional[int] = Field(default=None, ge=1, le=60)
    schedule_days: list[int] = []
    slots: list[ClassSlot] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=500)


class ClassDeleteResponse(BaseModel):
    status: str
    student_count: int
