-- Let the admin record what a manual payment actually was (e.g. "GPay",
-- "Netbanking", "Cheque") instead of it always showing as generic "Cash" —
-- covers payments made externally, before the app existed, via any channel.
-- NULL on older rows; falls back to the existing Cash/Online inference.
alter table public.payments
  add column if not exists method text;
