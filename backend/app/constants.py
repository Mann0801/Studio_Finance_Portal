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
# 'monthly' is the class's normal fee, billed every calendar month. 'package_3mo'
# only applies to a class with a package price configured (classes.package_3mo_fee_paise)
# — the student pays that price once per 3-month cycle (from their join month) and
# owes nothing the other two months.
PLAN_MONTHLY = "monthly"
PLAN_PACKAGE_3MO = "package_3mo"

PLANS = (PLAN_MONTHLY, PLAN_PACKAGE_3MO)
