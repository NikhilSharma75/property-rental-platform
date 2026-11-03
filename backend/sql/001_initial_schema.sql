-- 001: complete initial schema for RentEase.
--
-- Run this ONLY on a fresh Supabase project (SQL editor), then run:
--   002_core_functions.sql
--   003_storage_buckets.sql
--   005_admin_panel.sql ... 008_audit_hardening.sql
--
-- The statements are written with IF NOT EXISTS where Postgres supports it, so running the file
-- twice is harmless. It is not a replacement for the migrations 005-008 on an existing database.

create extension if not exists pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('TENANT', 'LANDLORD', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_type as enum ('RENT', 'DEPOSIT', 'OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'APPLICATION_SUBMITTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED',
    'LEASE_READY', 'LEASE_ACTIVATED', 'LEASE_EXPIRING',
    'INVOICE_CREATED', 'RENT_REMINDER', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED',
    'MAINTENANCE_CREATED', 'MAINTENANCE_STATUS_UPDATED', 'MESSAGE_RECEIVED',
    'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'REPORT_UPDATED',
    'APPROVAL_EXPIRED', 'RESERVATION_RELEASED', 'LEASE_ENDED'
  );
exception when duplicate_object then null; end $$;

-- ─── Users & auth ───────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  role public.user_role not null default 'TENANT',
  phone text,
  profile_image_url text,
  is_verified boolean not null default false,
  is_suspended boolean not null default false,
  suspended_reason text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date_of_birth date,
  bio text,
  alternate_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text
);

create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.landlord_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  government_id_type text check (government_id_type in ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE')),
  government_id_number text,
  government_id_document_path text,
  business_name text,
  business_registration_number text,
  tax_id text,
  proof_of_ownership_path text,
  status text not null default 'NOT_SUBMITTED'
    check (status in ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED')),
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Listings ───────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.users(id),
  title text not null,
  description text,
  property_type text not null
    check (property_type in ('APARTMENT', 'HOUSE', 'VILLA', 'STUDIO', 'TOWNHOUSE', 'CONDO', 'OTHER')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'AVAILABLE', 'RESERVED', 'RENTED', 'ARCHIVED')),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text,
  country text,
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms numeric not null default 0 check (bathrooms >= 0),
  area_sqft numeric check (area_sqft is null or area_sqft >= 0),
  rent_amount numeric not null check (rent_amount >= 0),
  deposit_amount numeric check (deposit_amount is null or deposit_amount >= 0),
  amenities text[] not null default '{}',
  images jsonb not null default '[]'::jsonb,
  latitude double precision check (latitude is null or (latitude between -90 and 90)),
  longitude double precision check (longitude is null or (longitude between -180 and 180)),
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  category text not null
    check (category in ('USER_DOCUMENT', 'LEASE_DOCUMENT', 'RECEIPT', 'MAINTENANCE_ATTACHMENT', 'APPLICATION_DOCUMENT')),
  related_id uuid,
  bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  unit_label text not null check (char_length(unit_label) between 1 and 40),
  floor integer check (floor between -5 and 200),
  bedrooms smallint not null check (bedrooms between 0 and 20),
  bathrooms numeric not null check (bathrooms between 0 and 20),
  area_sqft numeric check (area_sqft is null or area_sqft >= 0),
  rent_amount numeric not null check (rent_amount >= 0),
  deposit_amount numeric check (deposit_amount is null or deposit_amount >= 0),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNAVAILABLE')),
  reserved_application_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Applications & leases ──────────────────────────────────────────────────
create table if not exists public.rental_applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  tenant_id uuid not null references public.users(id),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')),
  desired_move_in_date date not null,
  lease_duration_months integer not null check (lease_duration_months between 1 and 60),
  monthly_income numeric check (monthly_income is null or monthly_income >= 0),
  employment_status text,
  employer_name text,
  additional_notes text,
  rejection_reason text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  unit_id uuid references public.units(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The two-table cycle is completed after both tables exist.
do $$ begin
  alter table public.units
    add constraint units_reserved_application_id_fkey
    foreign key (reserved_application_id) references public.rental_applications(id);
exception when duplicate_object then null; end $$;

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.rental_applications(id),
  property_id uuid not null references public.properties(id),
  tenant_id uuid not null references public.users(id),
  landlord_id uuid not null references public.users(id),
  unit_id uuid references public.units(id),
  rent_amount numeric not null check (rent_amount >= 0),
  security_deposit numeric not null default 0 check (security_deposit >= 0),
  lease_start_date date not null,
  lease_end_date date not null,
  lease_duration_months integer not null check (lease_duration_months between 1 and 60),
  terms text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED')),
  signed_by_tenant boolean not null default false,
  signed_by_landlord boolean not null default false,
  expiry_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lease_end_date > lease_start_date)
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  tenant_id uuid not null references public.users(id),
  landlord_id uuid not null references public.users(id),
  lease_id uuid references public.leases(id),
  category text not null
    check (category in ('PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'PEST_CONTROL', 'OTHER')),
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')),
  title text not null,
  description text not null,
  status text not null default 'SUBMITTED'
    check (status in ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  assigned_to text,
  landlord_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  property_id uuid not null references public.properties(id),
  tenant_id uuid not null references public.users(id),
  landlord_id uuid not null references public.users(id),
  type public.payment_type not null default 'RENT',
  description text,
  period text,
  amount numeric not null check (amount > 0),
  currency text not null default 'inr',
  status public.payment_status not null default 'PENDING',
  due_date date,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  receipt_number text unique,
  paid_at timestamptz,
  failure_reason text,
  rent_reminder_sent_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Messaging & notifications ──────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.users(id),
  landlord_id uuid not null references public.users(id),
  property_id uuid references public.properties(id),
  application_id uuid references public.rental_applications(id),
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Moderation ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('COMPLAINT', 'REVIEW_FLAG', 'LISTING_REPORT')),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text check (target_type in ('USER', 'PROPERTY', 'REVIEW', 'LEASE', 'OTHER')),
  target_id uuid,
  subject text not null check (char_length(subject) between 3 and 150),
  details text check (details is null or char_length(details) <= 2000),
  resolution text check (resolution is null or char_length(resolution) <= 1000),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 2000),
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (property_id, author_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index if not exists users_created_idx on public.users (created_at desc);
create index if not exists users_role_idx on public.users (role);
create index if not exists refresh_tokens_hash_idx on public.refresh_tokens (token_hash);
create index if not exists password_reset_tokens_hash_idx on public.password_reset_tokens (token_hash);

create index if not exists properties_landlord_idx on public.properties (landlord_id, created_at desc);
create index if not exists properties_status_idx on public.properties (status);
create index if not exists properties_city_idx on public.properties (lower(city));
create index if not exists properties_search_vector_idx on public.properties using gin (search_vector);

create unique index if not exists favorites_user_property_uniq on public.favorites (user_id, property_id);
create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

create unique index if not exists units_property_label_uniq on public.units (property_id, unit_label);
create index if not exists units_property_idx on public.units (property_id);
create index if not exists units_reserved_application_idx on public.units (reserved_application_id);

create index if not exists applications_property_idx on public.rental_applications (property_id, created_at desc);
create index if not exists applications_tenant_idx on public.rental_applications (tenant_id, created_at desc);
create index if not exists applications_status_idx on public.rental_applications (status);
-- One open application per tenant per property/unit (the API turns 23505 into a friendly 409).
create unique index if not exists applications_one_open_per_tenant_target
  on public.rental_applications (tenant_id, property_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('PENDING', 'APPROVED');

create index if not exists leases_tenant_idx on public.leases (tenant_id, created_at desc);
create index if not exists leases_landlord_idx on public.leases (landlord_id, created_at desc);
create index if not exists leases_property_idx on public.leases (property_id);
create index if not exists leases_unit_idx on public.leases (unit_id);
-- Matches 007: at most one live lease per application and per property.
create unique index if not exists leases_one_live_per_application
  on public.leases (application_id) where status in ('DRAFT', 'ACTIVE') and application_id is not null;
create unique index if not exists leases_one_live_per_property
  on public.leases (property_id) where status in ('DRAFT', 'ACTIVE');

create index if not exists maintenance_property_idx on public.maintenance_requests (property_id, created_at desc);
create index if not exists maintenance_tenant_idx on public.maintenance_requests (tenant_id, created_at desc);
create index if not exists maintenance_landlord_idx on public.maintenance_requests (landlord_id, created_at desc);

create index if not exists payments_lease_idx on public.payments (lease_id, created_at desc);
create index if not exists payments_tenant_idx on public.payments (tenant_id, created_at desc);
create index if not exists payments_landlord_idx on public.payments (landlord_id, created_at desc);
create index if not exists payments_paid_at_idx on public.payments (paid_at) where status = 'SUCCEEDED';

create index if not exists conversations_tenant_idx on public.conversations (tenant_id);
create index if not exists conversations_landlord_idx on public.conversations (landlord_id);
-- Stops a race between two approvals creating the same conversation twice. If existing data has
-- duplicates, the index is skipped with a notice instead of failing the whole install.
do $$ begin
  create unique index conversations_tenant_landlord_property_uniq
    on public.conversations (tenant_id, landlord_id, property_id);
exception when unique_violation then
  raise notice 'conversations has duplicate (tenant, landlord, property) rows; unique index skipped';
when duplicate_table then null; end $$;

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_kind_idx on public.reports (kind);
create unique index if not exists reports_one_open_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where status in ('OPEN', 'INVESTIGATING') and target_id is not null;

create index if not exists reviews_property_idx on public.reviews (property_id) where is_hidden = false;
create index if not exists reviews_created_idx on public.reviews (created_at desc);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_type, target_id);

-- ─── updated_at + search vector triggers ────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.properties_search_vector_refresh() returns trigger
language plpgsql as $$
begin
  new.search_vector = to_tsvector(
    'english',
    coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' ||
    coalesce(new.city, '') || ' ' || coalesce(new.address_line1, '')
  );
  return new;
end $$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists landlord_verifications_set_updated_at on public.landlord_verifications;
create trigger landlord_verifications_set_updated_at before update on public.landlord_verifications
  for each row execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

drop trigger if exists properties_search_vector_trg on public.properties;
create trigger properties_search_vector_trg before insert or update of title, description, city, address_line1
  on public.properties for each row execute function public.properties_search_vector_refresh();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at before update on public.units
  for each row execute function public.set_updated_at();

drop trigger if exists rental_applications_set_updated_at on public.rental_applications;
create trigger rental_applications_set_updated_at before update on public.rental_applications
  for each row execute function public.set_updated_at();

drop trigger if exists leases_set_updated_at on public.leases;
create trigger leases_set_updated_at before update on public.leases
  for each row execute function public.set_updated_at();

drop trigger if exists maintenance_requests_set_updated_at on public.maintenance_requests;
create trigger maintenance_requests_set_updated_at before update on public.maintenance_requests
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- audit_log is append-only (same guard as 008_audit_hardening.sql).
create or replace function public.audit_log_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'audit_log is append-only';
  end if;
  if tg_op = 'UPDATE' then
    if new.actor_id is null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
      return new;
    end if;
    raise exception 'audit_log is append-only';
  end if;
  return new;
end $$;

drop trigger if exists audit_log_guard_trg on public.audit_log;
create trigger audit_log_guard_trg
  before update or delete on public.audit_log
  for each row execute function public.audit_log_guard();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- The Express API uses the service-role key (bypasses RLS). The browser only gets the anon key,
-- which must not be able to read or write these tables directly.
alter table public.users enable row level security;
alter table public.refresh_tokens enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.landlord_verifications enable row level security;
alter table public.properties enable row level security;
alter table public.favorites enable row level security;
alter table public.documents enable row level security;
alter table public.units enable row level security;
alter table public.rental_applications enable row level security;
alter table public.leases enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.payments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_log enable row level security;
