-- A second monthly tier some session-pack classes offer alongside their normal
-- fee_paise/sessions_per_month — e.g. Gymnastics: ₹2,800 for 8 sessions/month
-- normally, or ₹1,600 for 4 sessions/month on this lighter alternative. Billed
-- every month like the normal tier (no free months, unlike the 3-month
-- package). Optional per class — null on either column means no alt tier.
alter table public.classes add column if not exists alt_fee_paise integer;
alter table public.classes add column if not exists alt_sessions_per_month integer;

alter table public.enrollments drop constraint if exists enrollments_plan_check;
alter table public.enrollments add constraint enrollments_plan_check
  check (plan in ('monthly', 'package_3mo', 'session_alt'));
