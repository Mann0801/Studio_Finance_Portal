"""Fee-type constants for the dynamic class catalogue.

Class definitions (name, schedule, fee, timing slots) now live in the ``classes``
table and are managed by the admin at runtime — see ``classes_store`` and
``routers/classes``. This module only names the four fee models a class can use.

  * MONTHLY      — a flat monthly fee; the join month is pro-rata by days.
  * SESSION_PACK — a fixed price for N sessions/month; join month pro-rata by
                   remaining class days (capped at N).
  * PER_SESSION  — a price per individual session; charged per scheduled day.
  * ENQUIRY      — no fixed fee / no online payment; the studio arranges it.
"""
from __future__ import annotations

MONTHLY = "monthly"
SESSION_PACK = "session_pack"
PER_SESSION = "per_session"
ENQUIRY = "enquiry"

FEE_TYPES = (MONTHLY, SESSION_PACK, PER_SESSION, ENQUIRY)

# An enrollment-level billing plan, independent of the class's fee_type above.
#
#   * PLAN_MONTHLY      — the class's normal fee, billed every calendar month.
#   * PLAN_PACKAGE_3MO  — only for a class with a package price configured
#                         (classes.package_3mo_fee_paise) — the student pays that
#                         price once per 3-month cycle (from their join month) and
#                         owes nothing the other two months.
#   * PLAN_SESSION_ALT  — only for a SESSION_PACK class with an alternate tier
#                         configured (classes.alt_fee_paise/alt_sessions_per_month)
#                         — a second, usually lighter, monthly price/session-count
#                         option billed every month like the class's normal tier
#                         (e.g. Gymnastics: 8 sessions/₹2,800 normally, or
#                         4 sessions/₹1,600 on this plan).
PLAN_MONTHLY = "monthly"
PLAN_PACKAGE_3MO = "package_3mo"
PLAN_SESSION_ALT = "session_alt"

PLANS = (PLAN_MONTHLY, PLAN_PACKAGE_3MO, PLAN_SESSION_ALT)
