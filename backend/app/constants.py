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
