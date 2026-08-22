-- Multiple classes per student. Additive + deterministic — safe to run on the
-- live database. Run this ONLY when deploying the multi-class backend/frontend
-- together (they assume this schema); do not run it ahead of that deploy.
--
-- New public.enrollments: the source of truth for which classes a student is
-- in. students.batch/batch_slot/join_date/whatsapp_joined are KEPT and mirror
-- the student's first/primary enrollment, so nothing that still reads them
-- breaks and the NOT NULL columns on students stay valid.

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id   text not null,
  batch_slot text,
  join_date  date not null,
  whatsapp_joined boolean not null default false,
  active boolean not null default true,   -- reserved for a future "leave class"
  created_at timestamptz not null default now(),
  unique (student_id, class_id)
);

alter table public.enrollments enable row level security;
-- The backend uses the service-role key for all reads/writes here (bypasses
-- RLS), same as students/payments. No student-facing policy needed yet.

-- Backfill: every current student -> one enrollment from their existing class.
insert into public.enrollments (student_id, class_id, batch_slot, join_date, whatsapp_joined)
  select id, batch, batch_slot, join_date, coalesce(whatsapp_joined, false)
  from public.students
  where batch is not null
on conflict (student_id, class_id) do nothing;

-- ── payments become per-class ──────────────────────────────────────────────
alter table public.payments add column if not exists class_id text;

update public.payments p set class_id = s.batch
  from public.students s
  where p.student_id = s.id and p.class_id is null;

alter table public.payments alter column class_id set not null;

-- Swap the uniqueness from (student_id, period) -> (student_id, class_id, period).
-- Drop whatever the old unique constraint on (student_id, period) is named.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.payments'::regclass and contype = 'u'
     and conkey = (
       select array_agg(attnum order by attnum) from pg_attribute
       where attrelid = 'public.payments'::regclass and attname in ('student_id', 'period')
     );
  if c is not null then
    execute format('alter table public.payments drop constraint %I', c);
  end if;
end $$;

alter table public.payments
  add constraint payments_student_class_period_key unique (student_id, class_id, period);

create index if not exists payments_class_period_idx on public.payments (class_id, period);
create index if not exists enrollments_student_idx on public.enrollments (student_id);
