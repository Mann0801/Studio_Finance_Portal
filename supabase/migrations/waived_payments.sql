-- Let the admin waive a month's fee (e.g. dues that were charged by mistake,
-- or a month the studio forgives) without a payment existing. A waived row
-- has paid_paise = 0 and is excluded from what's owed everywhere it's checked.
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('created', 'paid', 'failed', 'waived'));
