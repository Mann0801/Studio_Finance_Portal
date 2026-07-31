-- Track whether a student has joined their class's WhatsApp group, so the
-- reminder banner/prompt persists per account (not just per device) and clears
-- once for good. Defaults false for everyone; existing students will see the
-- reminder until they tap Join.
alter table public.students
  add column if not exists whatsapp_joined boolean not null default false;
