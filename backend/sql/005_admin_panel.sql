-- Admin panel migration. Run once in the Supabase SQL editor.
-- Service-role access (your Express API) bypasses RLS; the anon key gets NOTHING on these tables.

alter table users
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('COMPLAINT','REVIEW_FLAG','LISTING_REPORT')),
  status text not null default 'OPEN' check (status in ('OPEN','INVESTIGATING','RESOLVED','DISMISSED')),
  reporter_id uuid references users(id) on delete set null,
  target_type text check (target_type in ('USER','PROPERTY','REVIEW','LEASE','OTHER')),
  target_id uuid,
  subject text not null check (char_length(subject) between 3 and 150),
  details text check (char_length(details) <= 2000),
  resolution text,
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reports_status_created_idx on reports (status, created_at desc);
create index if not exists reports_kind_idx on reports (kind);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  lease_id uuid references leases(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (property_id, author_id)
);
create index if not exists reviews_property_idx on reviews (property_id) where is_hidden = false;
create index if not exists reviews_created_idx on reviews (created_at desc);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists audit_log_target_idx on audit_log (target_type, target_id);

-- Helpful indexes for admin lists / analytics
create index if not exists users_created_idx on users (created_at desc);
create index if not exists users_role_idx on users (role);
create index if not exists properties_status_idx on properties (status);
create index if not exists payments_paid_at_idx on payments (paid_at) where status = 'SUCCEEDED';
create index if not exists landlord_verifications_status_idx on landlord_verifications (status);

-- Default-deny for anon/authenticated PostgREST access
alter table reports enable row level security;
alter table reviews enable row level security;
alter table audit_log enable row level security;

-- If notifications.type is constrained by a CHECK/enum, allow the new admin types too:
--   VERIFICATION_APPROVED, VERIFICATION_REJECTED
-- (inspect with: select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'notifications'::regclass;)
