# Studio Finance — Fitness Studio Management

A web app for a fitness studio: students sign up, pick a batch, and pay monthly fees
online via Razorpay; the admin tracks payment status, attendance, and revenue.

## Stack
- **Backend:** FastAPI (Python) — Render
- **Frontend:** React + Vite — Vercel
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **Payments:** Razorpay
- **Email reminders:** Resend (built, disabled until keys are added)
- **Scheduler:** Render Cron Job (month-end unpaid sweep)

## Batches & fees
| Batch       | Monthly fee |
|-------------|-------------|
| Yoga        | ₹2,500      |
| Zumba       | ₹2,000      |
| Gymnastics  | ₹3,000      |

First month is **pro-rata**: `round(fee × days_remaining / days_in_month)`,
where `days_remaining` is inclusive of the join day. All month math is in **IST**,
on **calendar months**. Every month after the first is the full fee.

## Repository layout
```
backend/    FastAPI app, fee logic, Razorpay, admin, cron
frontend/   React + Vite (student + admin UI)
supabase/   schema.sql (tables + Row-Level Security)
```

## Local setup

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in your values
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # then fill in your values
npm run dev
```

### Database
Run `supabase/schema.sql` in the Supabase SQL editor to create tables and RLS policies.

## Secrets
**Never commit real secrets.** All config is read from environment variables; see
`backend/.env.example` and `frontend/.env.example` for the variable names. For
deployment, set the same variables in the Render and Vercel dashboards.

## Status
Scaffold in progress — see the build plan. Payments are wired against Razorpay
**test mode** first.
