-- ============================================================================
-- Dynamic class catalogue migration — run ONCE in the Supabase SQL editor.
-- Non-breaking: the 8 seeded class ids equal the current students.batch values,
-- and traditional_yoga's slot keys equal existing batch_slot values (batch1..4).
-- ============================================================================

create table if not exists public.classes (
  id text primary key,
  name text not null,
  fee_type text not null check (fee_type in ('monthly','session_pack','per_session','enquiry')),
  fee_paise integer not null default 0 check (fee_paise >= 0),
  sessions_per_month integer,
  schedule_days integer[] not null default '{}',
  slots jsonb not null default '[]',
  start_time text,
  end_time text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
drop policy if exists "classes read active" on public.classes;
create policy "classes read active" on public.classes for select using (active = true);

insert into public.classes (id, name, fee_type, fee_paise, sessions_per_month, schedule_days, slots, start_time, end_time, description, sort_order) values
('senior_citizens_yoga','Senior Citizens Yoga','monthly',200000,null,'{0,1,2,3,4}','[]','5:45 AM','6:30 AM',null,0),
('traditional_yoga','Traditional Yoga','monthly',230000,null,'{0,1,2,3,4}','[{"key":"batch1","name":"Batch 1","start":"6:30 AM","end":"7:30 AM"},{"key":"batch2","name":"Batch 2","start":"7:30 AM","end":"8:30 AM"},{"key":"batch3","name":"Batch 3","start":"8:30 AM","end":"9:30 AM"},{"key":"batch4","name":"Batch 4","start":"5:00 PM","end":"6:00 PM"}]',null,null,null,1),
('weight_loss_yoga','Weight Loss Yoga','monthly',300000,null,'{0,1,2,3,4}','[]','6:00 PM','7:00 PM',null,2),
('prenatal_yoga','Prenatal Yoga','per_session',100000,null,'{5,6}','[]',null,null,null,3),
('gymnastics','Gymnastics','session_pack',280000,8,'{1,6}','[]',null,null,null,4),
('zumba','Zumba','session_pack',200000,8,'{5,6}','[]',null,null,null,5),
('kids_yoga','Kids Yoga','monthly',200000,null,'{}','[]',null,null,null,6),
('test_course','Test Course','session_pack',1000,1,'{0,1,2,3,4,5,6}','[]',null,null,'Test only — verifies live payments',7)
on conflict (id) do nothing;

alter table public.students drop constraint if exists students_batch_check;
