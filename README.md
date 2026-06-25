# Studio Finance — Fitness Studio Management

A mobile-first PWA for a fitness studio: students sign up, pick a batch, and pay
monthly fees online via Razorpay; the admin tracks payment status,
revenue analytics, and posts announcements.

## Stack
- **Backend:** FastAPI (Python) — deployed on **Render**
- **Frontend:** React + Vite (installable PWA) — deployed on **Vercel**
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **Payments:** Razorpay (orders + checkout + webhook)
- **Email reminders:** Resend (built, disabled until keys are added)

## Features
- **Students:** signup with mandatory fields (name, email, 10-digit phone,
  password, batch), immediate pro-rated first payment, dashboard with payment
  status and history, announcement banner, installable on the home screen.
- **Admin:** single login, stats strip, revenue analytics (this vs last month,
  per-batch expected vs collected and collection rate), batch chips, student
  cards with one-tap WhatsApp reminders, post/edit/delete announcements.

## Batches & fees
| Batch       | Monthly fee |
|-------------|-------------|
| Yoga        | ₹2,500      |
| Zumba       | ₹2,000      |
| Gymnastics  | ₹3,000      |

First month is **pro-rata**: `round(fee × days_remaining / days_in_month)`, where
`days_remaining` is inclusive of the join day. Every later month is the full fee,
due on the 1st. All month math is in **IST**, on **calendar months**.

## Repository layout
```
backend/    FastAPI app (fees, payments, admin, announcements, webhook)
frontend/   React + Vite PWA (student + admin UI)
supabase/   schema.sql (tables + Row-Level Security)
render.yaml         Render blueprint for the backend
frontend/vercel.json Vercel config (SPA rewrite + PWA headers)
```

---

## 1. Local setup

### Database
Run `supabase/schema.sql` in the Supabase SQL editor (creates `students`,
`payments`, `announcements` + RLS policies).

### Backend
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in your values (see below)
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # then fill in your values
npm run dev
```

---

## 2. Filling in `.env`

### `backend/.env`
| Variable | What to put |
|----------|-------------|
| `STUDIO_NAME` | Your studio's display name |
| `CORS_ORIGINS` | Comma-separated allowed origins. Local: `http://localhost:5173`. Prod: your Vercel URL |
| `TIMEZONE` | `Asia/Kolkata` |
| `STUDENT_PORTAL_URL` | Public URL of the frontend (used in WhatsApp reminder links) |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** key. **Server only — never in the frontend.** |
| `SUPABASE_JWT_SECRET` | Leave blank (student tokens are verified via the Supabase Auth API) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The single admin login you choose |
| `ADMIN_JWT_SECRET` | Any long random string (signs the admin session token) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys (use `rzp_test_*` for development) |
| `RAZORPAY_WEBHOOK_SECRET` | Set when you create the webhook (see step 5) |
| `RESEND_API_KEY` / `REMINDER_FROM_EMAIL` | Optional; leave blank to disable email |

### `frontend/.env`
Only **public** values go here (everything ships to the browser):
| Variable | What to put |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend URL. Local: `http://localhost:8000`. Prod: your Render URL |
| `VITE_SUPABASE_URL` | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → API Keys → **publishable**/anon key (safe with RLS) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay **key id** only (never the secret) |

---

## 3. Deploy the backend to Render

1. Push this repo to GitHub.
2. In Render: **New + → Blueprint**, select this repo. Render reads `render.yaml`
   and creates the `studio-finance-api` web service (root `backend/`, Python).
3. When prompted, fill in the env vars marked `sync: false` (everything from
   `backend/.env` above). `ADMIN_JWT_SECRET` is auto-generated.
   - Set `CORS_ORIGINS` and `STUDENT_PORTAL_URL` to your Vercel URL once you have it.
4. Deploy. Health check: `https://<your-backend>.onrender.com/health`.

You can also create the service manually: **New + → Web Service**, root directory
`backend`, build `pip install -r requirements.txt`, start
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, then add the env vars under
**Environment**.

## 4. Deploy the frontend to Vercel

1. In Vercel: **Add New → Project**, import this repo.
2. Set **Root Directory** to `frontend` (Framework auto-detects Vite;
   `frontend/vercel.json` handles the SPA rewrite and PWA headers).
3. Under **Settings → Environment Variables**, add the four `VITE_*` vars from
   `frontend/.env` (set `VITE_API_BASE_URL` to your Render URL).
4. Deploy. Then go back to Render and set `CORS_ORIGINS` / `STUDENT_PORTAL_URL`
   to this Vercel URL and redeploy the backend.

## 5. Razorpay webhook

In the Razorpay dashboard → **Settings → Webhooks → Add New Webhook**:
- **URL:** `https://<your-backend>.onrender.com/webhook/razorpay`
- **Secret:** choose one, and set it as `RAZORPAY_WEBHOOK_SECRET` on Render
- **Events:** `payment.captured` (and optionally `order.paid`)

The backend verifies the signature and marks the payment paid in Supabase. The
checkout callback also verifies instantly (so it works in local dev where
Razorpay can't reach `localhost`). Both paths are idempotent.

---

## Secrets
**Never commit real secrets.** All config is read from environment variables; see
`backend/.env.example` and `frontend/.env.example` for the variable names. The
Supabase secret key and Razorpay key secret live only in the backend env.

## Tests
```bash
cd backend && source .venv/bin/activate && python -m pytest -q
cd frontend && npm run lint && npm run build
```
