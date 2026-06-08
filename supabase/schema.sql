-- Studio Finance — database schema + Row-Level Security.
-- Run this in the Supabase SQL editor.
--
-- Model: students authenticate via Supabase Auth (auth.users). Each student has
-- one row in public.students whose id == auth.users.id. The FastAPI backend uses
-- the service-role key and therefore BYPASSES RLS for all writes — that is the
-- only path allowed to set payment amounts/status. RLS below only grants each
-- student READ access to their own rows.

-- ── students ────────────────────────────────────────────────────────────────
create table if not exists public.students (
    id          uuid primary key references auth.users (id) on delete cascade,
    name        text        not null,
    phone       text        not null,        -- normalized, with country code (e.g. 91XXXXXXXXXX)
    email       text        not null,
    batch       text        not null check (batch in ('yoga', 'zumba', 'gymnastics')),
    join_date   date        not null,
    created_at  timestamptz not null default now()
);

-- ── payments ────────────────────────────────────────────────────────────────
-- One row per (student, calendar month). amount_paise is the server-computed,
-- locked amount. status transitions created -> paid (via verified Razorpay
-- webhook) or created -> failed.
create table if not exists public.payments (
    id                  uuid primary key default gen_random_uuid(),
    student_id          uuid not null references public.students (id) on delete cascade,
    period              text not null,            -- 'YYYY-MM'
    amount_paise        integer not null check (amount_paise >= 0),
    is_prorata          boolean not null default false,
    status              text not null default 'created'
                            check (status in ('created', 'paid', 'failed')),
    razorpay_order_id   text,
    razorpay_payment_id text,
    paid_at             timestamptz,
    created_at          timestamptz not null default now(),
    unique (student_id, period)
);

create index if not exists payments_period_idx on public.payments (period);
create index if not exists payments_order_idx  on public.payments (razorpay_order_id);

-- ── attendance ──────────────────────────────────────────────────────────────
-- One row per (student, day). Unique constraint enforces "once per day".
create table if not exists public.attendance (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid not null references public.students (id) on delete cascade,
    date        date not null,                    -- IST calendar date
    created_at  timestamptz not null default now(),
    unique (student_id, date)
);

create index if not exists attendance_date_idx on public.attendance (date);

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table public.students   enable row level security;
alter table public.payments   enable row level security;
alter table public.attendance enable row level security;

-- Students may read only their own rows. (Service role bypasses RLS for writes.)
drop policy if exists "students read own" on public.students;
create policy "students read own" on public.students
    for select using (auth.uid() = id);

drop policy if exists "payments read own" on public.payments;
create policy "payments read own" on public.payments
    for select using (auth.uid() = student_id);

drop policy if exists "attendance read own" on public.attendance;
create policy "attendance read own" on public.attendance
    for select using (auth.uid() = student_id);
