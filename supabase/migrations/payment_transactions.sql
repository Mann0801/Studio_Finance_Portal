-- A ledger of every individual money-in event, separate from `payments`
-- (which stays exactly as-is: one row per student/class/month tracking what's
-- due and the running total received). Previously a partial cash payment and
-- its later remainder both wrote into that same `payments` row, so the
-- remainder silently overwrote the partial's own date/method and only one
-- receipt ever existed for the month. This table records each contribution
-- on its own row so each gets its own history entry and its own receipt.
create table if not exists public.payment_transactions (
    id                  uuid primary key default gen_random_uuid(),
    student_id          uuid not null references public.students (id) on delete cascade,
    class_id            text not null,
    period              text not null,            -- 'YYYY-MM' — which month this contributed to
    amount_paise        integer not null check (amount_paise > 0),
    method              text,                      -- free-text label (GPay, Cheque, ...); null = infer Cash/Online
    razorpay_payment_id text,
    paid_at             timestamptz not null default now(),
    created_at          timestamptz not null default now()
);

create index if not exists payment_transactions_student_class_period_idx
    on public.payment_transactions (student_id, class_id, period);

-- Backfill: one transaction per existing payments row that has money in it,
-- so history isn't empty for anyone who paid before this table existed.
insert into public.payment_transactions
    (student_id, class_id, period, amount_paise, method, razorpay_payment_id, paid_at)
select student_id, class_id, period, paid_paise, method, razorpay_payment_id,
       coalesce(paid_at, created_at)
from public.payments
where coalesce(paid_paise, 0) > 0
on conflict do nothing;

alter table public.payment_transactions enable row level security;

drop policy if exists "payment transactions read own" on public.payment_transactions;
create policy "payment transactions read own" on public.payment_transactions
    for select using (auth.uid() = student_id);
