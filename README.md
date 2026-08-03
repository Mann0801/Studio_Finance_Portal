# Studio Finance — Fitness Studio Management

A mobile-first PWA for a fitness studio: students sign up with a phone number,
pick a class, and pay monthly fees online via Razorpay; the admin manages the
class catalogue, tracks payment status month by month, records cash, and posts
announcements.

## Stack
- **Backend:** FastAPI (Python) — deployed on **Render**
- **Frontend:** React + Vite (installable PWA) — deployed on **Vercel**
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **Payments:** Razorpay (orders + checkout + webhook)

## Features
- **Students:** phone-number + password signup (no email required), pick a class
  and studio join date, immediate pro-rated first payment, dashboard showing the
  current month's due plus any overdue months, payment history, per-class
  WhatsApp group, announcement banner, installable on the home screen.
- **Admin:** single login; collection stats (this vs last month, per-class
  expected vs collected and collection rate); month-by-month view of every
  payment across all classes; per-class rosters split into paid/unpaid with
  universal member search; a runtime class catalogue (add/edit/delete classes,
  fees, schedules and timing slots — no redeploy); cash recording including
  partial payments; one-tap WhatsApp reminders; member management with
  join-date edits that recompute dues and admin password resets;
  post/edit/delete announcements.

## Classes & fees
Classes are a **runtime catalogue** stored in Postgres and managed from the admin
UI — the studio adds, edits or removes classes (name, fee type, fee, schedule
days, timing slots) with no redeploy. Signup options, dues, rosters and revenue
breakdowns all query this catalogue dynamically. Fee types support monthly fees
and session-based fees.

The first month is **pro-rata**: for monthly classes,
`round(fee × days_remaining / days_in_month)` where `days_remaining` is inclusive
of the join day (a join on the 1st bills the full month); session-based classes
pro-rate by remaining sessions. Every later month is the full fee, due on the
1st. Cash can be recorded in full or in part — a month stays unpaid until the
received total clears the due. All month math is in **IST**, on **calendar
months**.

## Repository layout
```
backend/    FastAPI app (fees, payments, admin, classes, announcements, webhook)
frontend/   React + Vite PWA (student + admin UI)
supabase/   schema.sql (base tables + RLS) and migrations/ (incremental changes)
render.yaml         Render blueprint for the backend
frontend/vercel.json Vercel config (SPA rewrite + PWA headers)
```

---

## Running it locally

1. **Database** — run `supabase/schema.sql` in the Supabase SQL editor, then each
   file in `supabase/migrations/` in order (these add the dynamic `classes`
   catalogue, partial-payment tracking, and per-class WhatsApp fields).
2. **Backend**
   ```bash
   cd backend
   python3.11 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env        # fill in Supabase, Razorpay and admin values
   uvicorn app.main:app --reload
   ```
3. **Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env        # fill in the VITE_* values
   npm run dev
   ```

Every config value is documented inline in `backend/.env.example` and
`frontend/.env.example`. Only public `VITE_*` values go in the frontend env; the
Supabase secret key and Razorpay key secret live only in the backend.

## Deploying
Backend on **Render** (`render.yaml` blueprint, root `backend/`), frontend on
**Vercel** (root `frontend/`; `vercel.json` handles SPA routing + PWA headers).
Set the prod env vars in each dashboard, point the frontend's API URL at the
Render backend, and set the backend's CORS origins to the Vercel URL. Payments
are confirmed by a Razorpay webhook (`/webhook/razorpay`) with HMAC signature
verification; the checkout callback verifies too, and both paths are idempotent.

## Tests
```bash
cd backend && source .venv/bin/activate && python -m pytest -q
cd frontend && npm run lint && npm run build
```
