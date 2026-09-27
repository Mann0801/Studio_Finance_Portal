-- Student self-reported "I attended this session today" for PER_SESSION
-- classes (e.g. Prenatal Yoga). Replaces the old assumption that every
-- scheduled class day was actually held — fees.compute_due now counts these
-- rows instead of counting scheduled weekdays, so billing only happens once a
-- session is actually confirmed to have run.
create table if not exists public.attendance (
    id           uuid primary key default gen_random_uuid(),
    student_id   uuid not null references public.students (id) on delete cascade,
    class_id     text not null,
    session_date date not null,
    marked_by    text not null default 'student' check (marked_by in ('student', 'admin')),
    created_at   timestamptz not null default now(),
    unique (student_id, class_id, session_date)
);

create index if not exists attendance_lookup_idx
  on public.attendance (class_id, session_date);

alter table public.attendance enable row level security;
-- The backend uses the service-role key for all reads/writes here (bypasses
-- RLS), same as enrollments/payments/enrollment_pauses.
