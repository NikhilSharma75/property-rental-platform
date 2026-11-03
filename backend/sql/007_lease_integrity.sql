-- 007: lease integrity.
-- BEFORE running, check for existing duplicate live leases (the index creation fails if any exist):
--   select application_id, count(*) from leases where status in ('DRAFT','ACTIVE') group by 1 having count(*) > 1;
--   select property_id,    count(*) from leases where status in ('DRAFT','ACTIVE') group by 1 having count(*) > 1;

create unique index if not exists leases_one_live_per_application
  on leases (application_id) where status in ('DRAFT','ACTIVE') and application_id is not null;

-- Single-unit model. Drop this index if you later add multi-unit properties.
create unique index if not exists leases_one_live_per_property
  on leases (property_id) where status in ('DRAFT','ACTIVE');
