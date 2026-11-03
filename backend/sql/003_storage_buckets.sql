-- 003: storage buckets used by the API.
--
-- Safe to run on an existing project: existing buckets are left untouched. The API always writes
-- with the service-role key, so no storage RLS policies are required for server uploads.
--
-- Public buckets are readable by anyone with the URL (property photos / avatars).
-- Private buckets are only ever exposed through short-lived signed URLs.

insert into storage.buckets (id, name, public)
values
  ('property-images',       'property-images',       true),
  ('profile-images',        'profile-images',        true),
  ('verification-documents','verification-documents',false),
  ('user-documents',        'user-documents',        false),
  ('lease-documents',       'lease-documents',       false),
  ('receipts',              'receipts',              false),
  ('maintenance-attachments','maintenance-attachments', false),
  ('application-documents', 'application-documents', false)
on conflict (id) do nothing;
