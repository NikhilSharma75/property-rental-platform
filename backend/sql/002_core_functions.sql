-- 002: core database functions used by the API.
--
-- These six functions are called with supabase.rpc(...) from the Express backend. They are
-- security definer so they keep working when RLS is enabled, and they are idempotent to install
-- (create or replace). Run after 001_initial_schema.sql.
--
--   search_properties           public listing search, filtering, distance + pagination
--   approve_application         atomically reserve a unit/property and approve one application
--   release_application_hold    release a reservation (withdraw, cancel, expire)
--   mark_lease_occupied         flip a reserved target to occupied/rented
--   release_lease_target        make a target available again after a lease ends
--   expire_stale_applications   cron: expire applications whose hold has lapsed

-- These signatures match the ones used by the API. Drop first so this file can also UPGRADE a
-- database whose functions were created by an older version with a different return type
-- (CREATE OR REPLACE cannot change a function's return type).
drop function if exists public.expire_stale_applications();
drop function if exists public.release_lease_target(uuid);
drop function if exists public.mark_lease_occupied(uuid);
drop function if exists public.release_application_hold(uuid, text);
drop function if exists public.approve_application(uuid, uuid, integer);
drop function if exists public.search_properties(
  text, text, text, numeric, numeric, integer, numeric, text[],
  double precision, double precision, double precision, text, integer, integer
);

-- ─── Search ─────────────────────────────────────────────────────────────────
create or replace function public.search_properties(
  p_search text default null,
  p_city text default null,
  p_property_type text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_min_bathrooms numeric default null,
  p_amenities text[] default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_limit integer default 12
)
returns table (
  id uuid,
  landlord_id uuid,
  title text,
  description text,
  property_type text,
  status text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  bedrooms integer,
  bathrooms numeric,
  area_sqft numeric,
  rent_amount numeric,
  deposit_amount numeric,
  amenities text[],
  images jsonb,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  updated_at timestamptz,
  out_distance_km double precision,
  out_total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      p.*,
      case
        when p_lat is not null and p_lng is not null
             and p.latitude is not null and p.longitude is not null then
          6371.0 * acos(
            least(1.0, greatest(-1.0,
              sin(radians(p_lat)) * sin(radians(p.latitude)) +
              cos(radians(p_lat)) * cos(radians(p.latitude)) *
              cos(radians(p.longitude) - radians(p_lng))
            ))
          )
        else null
      end as distance_km
    from public.properties p
    where p.status = 'AVAILABLE'
      and (
        p_search is null or btrim(p_search) = ''
        or p.title ilike '%' || p_search || '%'
        or coalesce(p.description, '') ilike '%' || p_search || '%'
        or p.city ilike '%' || p_search || '%'
        or p.address_line1 ilike '%' || p_search || '%'
      )
      and (p_city is null or btrim(p_city) = '' or p.city ilike '%' || p_city || '%')
      and (p_property_type is null or btrim(p_property_type) = '' or p.property_type = p_property_type)
      and (p_min_price is null or p.rent_amount >= p_min_price)
      and (p_max_price is null or p.rent_amount <= p_max_price)
      and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
      and (p_min_bathrooms is null or p.bathrooms >= p_min_bathrooms)
      and (p_amenities is null or cardinality(p_amenities) = 0 or p.amenities @> p_amenities)
  ),
  within_radius as (
    select f.*
    from filtered f
    where p_radius_km is null
       or (f.distance_km is not null and f.distance_km <= p_radius_km)
  ),
  counted as (
    select w.*, count(*) over () as total_count
    from within_radius w
  )
  select
    c.id, c.landlord_id, c.title, c.description, c.property_type, c.status,
    c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country,
    c.bedrooms, c.bathrooms, c.area_sqft, c.rent_amount, c.deposit_amount,
    c.amenities, c.images, c.latitude, c.longitude, c.created_at, c.updated_at,
    case when p_radius_km is null and (p_lat is null or p_lng is null) then null else c.distance_km end,
    c.total_count
  from counted c
  order by
    case when p_sort = 'oldest' then c.created_at end asc,
    case when p_sort = 'price_asc' then c.rent_amount end asc,
    case when p_sort = 'price_desc' then c.rent_amount end desc,
    case when p_sort = 'distance' then c.distance_km end asc nulls last,
    c.created_at desc
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(coalesce(p_limit, 12), 1)
  limit greatest(coalesce(p_limit, 12), 1);
$$;

-- ─── Approve an application ─────────────────────────────────────────────────
create or replace function public.approve_application(
  p_app uuid,
  p_landlord uuid,
  p_hold_days integer default 7
)
returns public.rental_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.rental_applications%rowtype;
  v_prop public.properties%rowtype;
  v_unit public.units%rowtype;
  v_has_units boolean;
  v_hold integer := greatest(coalesce(p_hold_days, 7), 1);
begin
  select * into v_app from public.rental_applications where id = p_app for update;
  if not found then raise exception 'APP_NOT_FOUND'; end if;

  select * into v_prop from public.properties where id = v_app.property_id for update;
  if not found then raise exception 'APP_NOT_FOUND'; end if;

  if v_prop.landlord_id <> p_landlord then raise exception 'FORBIDDEN'; end if;
  if v_app.status <> 'PENDING' then raise exception 'NOT_PENDING'; end if;
  if v_app.expires_at is not null and v_app.expires_at < now() then raise exception 'APP_EXPIRED'; end if;

  if exists (
    select 1 from public.leases
    where application_id = v_app.id and status in ('DRAFT', 'ACTIVE')
  ) then
    raise exception 'LEASE_ACTIVE';
  end if;

  select exists (select 1 from public.units where property_id = v_prop.id) into v_has_units;

  if v_app.unit_id is not null then
    select * into v_unit
    from public.units
    where id = v_app.unit_id and property_id = v_prop.id
    for update;
    if not found then raise exception 'NOT_AVAILABLE'; end if;
    if v_unit.status <> 'AVAILABLE' then raise exception 'NOT_AVAILABLE'; end if;
    if exists (
      select 1 from public.leases
      where unit_id = v_unit.id and status in ('DRAFT', 'ACTIVE')
    ) then
      raise exception 'NOT_AVAILABLE';
    end if;

    update public.units
    set status = 'RESERVED', reserved_application_id = v_app.id, updated_at = now()
    where id = v_unit.id;
  else
    if v_has_units then
      -- The building has units, so the applicant must have chosen one.
      raise exception 'NOT_AVAILABLE';
    end if;
    if v_prop.status <> 'AVAILABLE' then raise exception 'NOT_AVAILABLE'; end if;
    if exists (
      select 1 from public.leases
      where property_id = v_prop.id and status in ('DRAFT', 'ACTIVE')
    ) then
      raise exception 'NOT_AVAILABLE';
    end if;

    update public.properties
    set status = 'RESERVED', updated_at = now()
    where id = v_prop.id;
  end if;

  update public.rental_applications
  set status = 'APPROVED',
      reviewed_by = p_landlord,
      reviewed_at = now(),
      expires_at = now() + make_interval(days => v_hold),
      updated_at = now()
  where id = v_app.id
  returning * into v_app;

  -- Competing applications for the same target are closed in the same transaction.
  update public.rental_applications
  set status = 'REJECTED',
      rejection_reason = 'Another application was approved for this property.',
      reviewed_by = p_landlord,
      reviewed_at = now(),
      updated_at = now()
  where property_id = v_app.property_id
    and id <> v_app.id
    and status = 'PENDING'
    and (v_app.unit_id is null or unit_id is not distinct from v_app.unit_id);

  return v_app;
end;
$$;

-- ─── Release a reservation ──────────────────────────────────────────────────
create or replace function public.release_application_hold(
  p_app uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.rental_applications%rowtype;
begin
  if p_new_status not in ('WITHDRAWN', 'REJECTED', 'EXPIRED') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_app from public.rental_applications where id = p_app for update;
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  if v_app.status not in ('PENDING', 'APPROVED') then raise exception 'NOT_PENDING'; end if;

  if v_app.status = 'APPROVED' then
    if exists (
      select 1 from public.leases
      where application_id = v_app.id and status = 'ACTIVE'
    ) then
      raise exception 'LEASE_ACTIVE';
    end if;

    update public.leases
    set status = 'CANCELLED', updated_at = now()
    where application_id = v_app.id and status = 'DRAFT';

    if v_app.unit_id is not null then
      update public.units
      set status = 'AVAILABLE', reserved_application_id = null, updated_at = now()
      where id = v_app.unit_id and reserved_application_id = v_app.id;
    else
      update public.properties
      set status = 'AVAILABLE', updated_at = now()
      where id = v_app.property_id
        and status = 'RESERVED'
        and not exists (
          select 1 from public.leases
          where property_id = v_app.property_id and status in ('DRAFT', 'ACTIVE')
        );
    end if;
  end if;

  update public.rental_applications
  set status = p_new_status, updated_at = now()
  where id = v_app.id;
end;
$$;

-- ─── Availability transitions ───────────────────────────────────────────────
create or replace function public.mark_lease_occupied(p_lease uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
begin
  select * into v_lease from public.leases where id = p_lease;
  if not found then raise exception 'LEASE_NOT_FOUND'; end if;

  if v_lease.unit_id is not null then
    update public.units
    set status = 'OCCUPIED', reserved_application_id = null, updated_at = now()
    where id = v_lease.unit_id;
  else
    update public.properties
    set status = 'RENTED', updated_at = now()
    where id = v_lease.property_id;
  end if;
end;
$$;

create or replace function public.release_lease_target(p_lease uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
begin
  select * into v_lease from public.leases where id = p_lease;
  if not found then raise exception 'LEASE_NOT_FOUND'; end if;

  if v_lease.unit_id is not null then
    update public.units u
    set status = 'AVAILABLE', reserved_application_id = null, updated_at = now()
    where u.id = v_lease.unit_id
      and not exists (
        select 1 from public.leases l
        where l.unit_id = u.id and l.id <> p_lease and l.status in ('DRAFT', 'ACTIVE')
      );
  else
    update public.properties p
    set status = 'AVAILABLE', updated_at = now()
    where p.id = v_lease.property_id
      and p.status in ('RENTED', 'RESERVED')
      and not exists (
        select 1 from public.leases l
        where l.property_id = p.id and l.id <> p_lease and l.status in ('DRAFT', 'ACTIVE')
      )
      and not exists (
        select 1 from public.rental_applications a
        where a.property_id = p.id
          and a.status = 'APPROVED'
          and a.id is distinct from v_lease.application_id
          and a.expires_at is not null
          and a.expires_at > now()
      );
  end if;
end;
$$;

-- ─── Cron: expire lapsed applications ──────────────────────────────────────
create or replace function public.expire_stale_applications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id
    from public.rental_applications a
    where a.status in ('PENDING', 'APPROVED')
      and a.expires_at is not null
      and a.expires_at < now()
      and not exists (
        select 1 from public.leases l
        where l.application_id = a.id and l.status = 'ACTIVE'
      )
    order by a.expires_at
    limit 500
    for update skip locked
  loop
    begin
      perform public.release_application_hold(r.id, 'EXPIRED');
      n := n + 1;
    exception when others then
      -- One bad row must not stop the rest of the sweep; it stays due for the next run.
      raise warning 'expire_stale_applications: application %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

-- Note: these functions are SECURITY DEFINER and are granted to the API roles by Supabase's
-- defaults. The Express backend always calls them with the service-role key; the browser never
-- calls them directly (the frontend only talks to /api/*).
