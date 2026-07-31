-- Move WhatsApp group links into the classes table so the admin can edit them
-- (switch groups) and the change reflects for students immediately. Seed the
-- existing links so nothing breaks; Kids Yoga / Test Course stay null (no group).
alter table public.classes
  add column if not exists whatsapp_group_url text;

update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/KMAkBeZeFOhDF7OXCgAuxT?s=cl&p=a&ilr=4' where id = 'traditional_yoga';
update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/GDUTB7korIIJd6WLxyMDvX?s=cl&p=a&ilr=4' where id = 'weight_loss_yoga';
update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/DxPvqNy1S7E4CGtC6kUpUZ?s=cl&p=a&ilr=4' where id = 'zumba';
update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/CtBlPOuDYMV3BiYD5bd2KQ?s=cl&p=a&ilr=4' where id = 'gymnastics';
update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/Gpg8fGwlhf91mOqGdSnD6S?s=cl&p=a&ilr=4' where id = 'senior_citizens_yoga';
update public.classes set whatsapp_group_url = 'https://chat.whatsapp.com/FgJejdWSV3QIu4U3CXUp0P?s=cl&p=a&ilr=4' where id = 'prenatal_yoga';
