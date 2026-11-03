-- 006: report management. Safe to run more than once.
alter table reports add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table reports add constraint reports_resolution_len
    check (resolution is null or char_length(resolution) <= 1000);
exception when duplicate_object then null; end $$;

create index if not exists reports_created_idx on reports (created_at desc);

-- One open report per reporter per target (stops repeat filing across days).
create unique index if not exists reports_one_open_per_reporter_target
  on reports (reporter_id, target_type, target_id)
  where status in ('OPEN', 'INVESTIGATING') and target_id is not null;
