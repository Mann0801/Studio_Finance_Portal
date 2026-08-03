# Studio Finance — Fitness Studio Management

A mobile-first web platform that runs the membership and payments side of a
fitness studio. It replaces the usual paper-and-WhatsApp routine — fees tracked
by hand, reminders forgotten, no real view of who owes what — with one system:
members pay their monthly fees from their phone, and the owner sees the whole
business at a glance and manages it themselves.

It's two apps on a single API. Members get a phone-first PWA that installs to the
home screen and opens like a native app. The owner gets an admin dashboard for
collections, rosters, the class catalogue, and cash. It's live and in real use.

## Stack

- **Backend:** FastAPI (Python), deployed on Render
- **Frontend:** React + Vite, an installable PWA (service worker + web manifest), deployed on Vercel
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **Payments:** Razorpay — live orders, checkout, and webhook

## What it does

**For members.** Signup is phone number + password — no email, since the members
don't use one. From the home screen they see exactly what they owe for the current
month, plus any earlier months they've missed, flagged as overdue and shown first
so nothing slips. They pay online in a couple of taps, keep a full payment history,
and jump straight into their class's WhatsApp group. Fees adjust to the day they
joined, so signing up mid-month bills only for the part of the month they're there.

**For the owner.** The admin dashboard is a real operating view of the studio:
monthly collections against what's expected, who's paid versus pending, and a
month-by-month breakdown of every payment across all classes in one place. Each
class shows its roster split into paid and unpaid, with search that finds any
member across every class. The owner manages the class catalogue directly — adding,
editing, or removing classes, fees, schedules, and timing slots — records walk-in
cash (including partial amounts), sends a pre-filled WhatsApp reminder to anyone
overdue with one tap, and handles member management like fixing a join date or
resetting a locked-out member's password.

## How it's built

**Server-authoritative payments.** The client never sends an amount. It sends
which member and which month; the backend computes what's genuinely owed from the
class fee, join date, and billing period, then creates the Razorpay order
server-side. Payments are confirmed by a Razorpay webhook with HMAC signature
verification before anything is written, and the checkout callback verifies too —
both paths are idempotent, so a dropped redirect or a duplicate webhook can't
charge or record twice.

**Runtime class catalogue.** Classes, fees, schedule days, and timing slots live
in Postgres, not in config files or environment variables. The owner edits them at
runtime through the admin UI, and everything downstream — signup options, dues,
rosters, revenue breakdowns — queries the catalogue dynamically. No redeploy to
change what the studio offers.

**A payments model built for reporting.** One row per member per period, carrying
status, amount due, amount received, and method. The admin views — monthly totals,
per-class paid/unpaid splits, overdue flags — are aggregations over this table
rather than logic reassembled in the frontend, which keeps the data clean and the
queries fast.

**Fee math as a pure function.** Billing takes join date, class type, fee, and
sessions per month and returns the amount due, with no side effects. Monthly
classes pro-rate by day (a join on the 1st bills the full month); session-based
classes pro-rate by remaining sessions; partial cash keeps a month unpaid until the
received total clears the due. It's fully unit-tested, because this is the part
that can't be "mostly right." All month math is in IST, on calendar months.

**A resilient network layer.** After tracking down intermittent request failures on
iOS Safari, every outgoing call — API, auth, payments — goes through a single
retry-aware client with explicit timeout handling. Nothing in the codebase makes a
raw fetch.

## Layout

```
backend/    FastAPI app (fees, payments, admin, classes, announcements, webhook)
frontend/   React + Vite PWA (member + admin UI)
supabase/   schema.sql (base tables + RLS) and migrations/ (incremental changes)
```
