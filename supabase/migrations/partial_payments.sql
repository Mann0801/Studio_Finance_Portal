-- Partial payments: track how much has been paid toward a month, so the admin
-- can record a cash amount smaller than the full fee. The month stays unpaid
-- (status 'created') until paid_paise reaches the full due, then flips to 'paid'.
-- Existing paid rows are fully paid, so backfill paid_paise = amount_paise.
alter table public.payments
  add column if not exists paid_paise integer not null default 0;

update public.payments set paid_paise = amount_paise where status = 'paid';
