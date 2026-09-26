-- A separate free-text note for a payment (e.g. "3-month package, covers
-- Sept-Nov"), distinct from `method` (Cash/GPay/Netbanking/...). Before this,
-- admins had nowhere to put that context except overloading the method field
-- with sentences instead of a payment type.
alter table public.payments add column if not exists note text;
alter table public.payment_transactions add column if not exists note text;
