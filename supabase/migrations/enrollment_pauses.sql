-- Let the admin freeze billing for one class a student is in (e.g. they're
-- away for a while) without touching their other classes. A ledger, not a
-- single flag, so a student who pauses more than once over time keeps every
-- past frozen window protected from ever being billed, even after resuming.
--
-- from_period/until_period are 'YYYY-MM', inclusive. until_period is null
-- while the pause is still in effect; resuming sets it to the last frozen
-- month, and every period in [from_period, until_period] never bills.
create table if not exists public.enrollment_pauses (
    id           uuid primary key default gen_random_uuid(),
    student_id   uuid not null references public.students (id) on delete cascade,
    class_id     text not null,
    from_period  text not null,
    until_period text,
    created_at   timestamptz not null default now()
);

create index if not exists enrollment_pauses_lookup_idx
  on public.enrollment_pauses (student_id, class_id);

alter table public.enrollment_pauses enable row level security;
-- The backend uses the service-role key for all reads/writes here (bypasses
-- RLS), same as enrollments/payments. No student-facing policy needed yet.
