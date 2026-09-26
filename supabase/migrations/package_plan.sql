-- 3-month package plan: a class can optionally offer paying once for 3 months
-- instead of the normal monthly fee. A student on the package pays the full
-- package price in the first month of every 3-month cycle (counted from their
-- join month, no proration even mid-month) and owes nothing in the two months
-- between — those months still show (as "Package"), never silently disappear.
alter table public.classes add column if not exists package_3mo_fee_paise integer;

-- Per-enrollment choice: 'monthly' (default, the class's normal fee) or
-- 'package_3mo' (only meaningful for a class with package_3mo_fee_paise set).
alter table public.enrollments add column if not exists plan text not null default 'monthly';
alter table public.enrollments drop constraint if exists enrollments_plan_check;
alter table public.enrollments add constraint enrollments_plan_check
  check (plan in ('monthly', 'package_3mo'));
