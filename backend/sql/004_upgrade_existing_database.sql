-- 004: one-time data fixes for an EXISTING RentEase database.
--
-- Run this AFTER 002_core_functions.sql has been applied. It only changes rows that the old
-- function left in an inconsistent state; it never deletes anything.
--
-- Read the SELECTs first, then run the UPDATEs in a maintenance window.

-- ─── 1. Approvals that never got an expiry ──────────────────────────────────
-- Older deployments of approve_application did not write expires_at. Those approvals hold a
-- property/unit forever and the expiry cron can never release them.
--
-- Preview what will be stamped:
select a.id, a.property_id, a.tenant_id, a.reviewed_at
from public.rental_applications a
where a.status = 'APPROVED'
  and a.expires_at is null
  and not exists (
    select 1 from public.leases l
    where l.application_id = a.id and l.status in ('DRAFT', 'ACTIVE')
  );

  

-- Give each of them a 7-day window from now. If no lease is created/signed in that window, the
-- normal expiry job releases the reservation and notifies both sides.
update public.rental_applications a
set expires_at = now() + interval '7 days',
    updated_at = now()
where a.status = 'APPROVED'
  and a.expires_at is null
  and not exists (
    select 1 from public.leases l
    where l.application_id = a.id and l.status in ('DRAFT', 'ACTIVE')
  );

-- ─── 2. Currency on unpaid invoices (OPTIONAL — decide before running) ──────
-- Older invoices were written with the old schema default 'usd' while the UI displayed INR.
-- Never rewrite SUCCEEDED/REFUNDED rows: those are historical payment records.
--
-- Preview:
--   select id, amount, currency, status, created_at
--   from public.payments
--   where status in ('PENDING', 'FAILED') and currency = 'usd';
--
-- If those invoices were meant to be INR, uncomment:
-- update public.payments
-- set currency = 'inr',
--     updated_at = now()
-- where status in ('PENDING', 'FAILED') and currency = 'usd';
--
-- Otherwise cancel them and create fresh INR invoices from the landlord account.

-- ─── 3. Verify ──────────────────────────────────────────────────────────────
select
  (select count(*) from public.rental_applications where status = 'APPROVED' and expires_at is null) as approvals_without_expiry,
  (select count(*) from public.payments where status in ('PENDING', 'FAILED') and currency <> 'inr') as unpaid_non_inr;
