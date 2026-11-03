# Audit & fixes — RentEase

This document records what was checked, what was broken, what was fixed, and what still needs a
human decision. It reflects the code in this package and a live inspection of the Supabase project
configured in `backend/.env`.

---

## 1. Audit method

- Read every backend route, controller, service, middleware, and job.
- Read the frontend API layer, every page, and the shared components.
- Compared the code against the supplied schema (tables, columns, enums, foreign keys).
- Ran the backend against the configured Supabase project:
  - `/api/health`, public search/filter/sort/pagination, property units, reviews, auth guards
  - fetched the PostgREST OpenAPI document to confirm the six RPC functions and their parameters
  - queried storage buckets, notification enum values, admin columns/tables
  - probed the `favorites` and `units` upsert constraints
- Ran the backend test suite, TypeScript, ESLint, and a production Next.js build.
- Created the full schema + RPC functions and exercised them in PGlite (embedded Postgres):
  approve/reject races, reservations, withdrawals, lease activation, expiry, search/distance.

---

## 2. Database objects: verified present in the configured project

| Object | Status |
|---|---|
| `search_properties` | present, correct parameters |
| `approve_application` | present |
| `release_application_hold` | present |
| `mark_lease_occupied` | present |
| `release_lease_target` | present |
| `expire_stale_applications` | present |
| 8 storage buckets | present, public/private flags correct |
| `favorites (user_id, property_id)` unique index | present (upsert probe succeeded) |
| `units (property_id, unit_label)` unique index | present (upsert probe succeeded) |
| `reports.updated_at`, `users.suspended_*` | present |
| notification enum values used by the code | all present |

The previous package shipped only migrations `005`–`008`, so the base tables and the six RPC
functions were missing from the zip even though they existed in the live database. This package now
includes `001_initial_schema.sql`, `002_core_functions.sql`, and `003_storage_buckets.sql` so a fresh
environment can be built from scratch.

**However, the live `approve_application` is an older implementation.** Every APPROVED application in
the live project has `expires_at = null`, including one approved on 2026-10-28. The API passes
`p_hold_days` and the UI tells tenants they are “reserved until …”, but the deployed function never
writes the expiry, so approvals hold a property forever and the expiry cron has nothing to release.
`002_core_functions.sql` contains the corrected function and is safe to re-run (it drops/recreates the
six functions to handle return-type differences). `004_upgrade_existing_database.sql` backfills a
7-day window for existing approvals without a lease.

---

## 3. Bugs fixed

### Backend — functional

1. **Applications to multi-unit buildings always failed.**
   The frontend sent `unitId`, but the Zod schema in `application.controller.ts` did not include it,
   so Zod stripped it. The service then saw “no unit chosen” and returned 400 for every building.
   `unitId` is now part of the schema.

2. **Tenants were never told when an application was rejected.**
   `notifyApplicationRejected` existed and was mocked in tests, but was never called. Rejection now
   sends the in-app notification + email with the landlord’s reason.

3. **Approving could return 500 after the approval was already committed.**
   Creating the conversation happened after the atomic RPC and was awaited without a catch. A
   conversation failure made the request fail while the application was approved. It is now
   best-effort and logged.

4. **Admin → Applications pagination was broken.**
   The controller never parsed `page`, so every request returned page 1. It now parses `page`/`limit`.

5. **Admin → Verifications pagination was broken.**
   The service ignored `page`/`limit` and returned `{ items }` instead of the paged envelope the UI
   expects. It now returns `{ items, total, page, limit, totalPages }`.

6. **Saving any edit on a RESERVED property failed.**
   The form sent the current status (`RESERVED`), which the controller’s enum rejected. The enum now
   accepts it, the service accepts an unchanged status, and the form only sends status when it changed.

7. **A landlord could release a tenant’s reservation by editing the property.**
   Changing `RESERVED` → `AVAILABLE` was allowed. It is now blocked with a clear 409; use withdrawal,
   expiry, or admin moderation.

8. **Search pagination showed “0 properties” on an out-of-range page.**
   The SQL function returns one row per match, so page 2 of a short result set carried no total. The
   service now asks for page 1/limit 1 to recover the real total, letting the UI clamp back.

9. **New tenants got an error on their first `/conversations` call.**
   The service ran `.in("conversation_id", [])` when the list was empty, producing an invalid
   PostgREST filter. It now returns `[]` before that query.

10. **Unit ID was accepted by the lease controller but ignored by the service.**
    Removed the unused field to avoid a false promise in the API contract.

11. **Deposit invoices could be charged in USD while the UI showed INR.**
    Invoice creation now writes `currency` from `DEFAULT_CURRENCY` (default `INR`); the security
    deposit invoice created with a lease does the same. Emails format using the payment’s currency.

12. **A deposit payment whose lease activation failed was never retried.**
    A repeated Stripe webhook returned early because the payment was already `SUCCEEDED`. It now
    retries `activateLeaseIfReady` for deposits on duplicate events.

13. **Reset password did not touch `users.updated_at`.**
    Fixed.

14. **Registration race returned 500 on a duplicate email.**
    A unique-violation (`23505`) now returns 409 with the same friendly message as the pre-check.

15. **Admin verification review could silently no-op on a race.**
    The conditional update is now checked; losing the race returns 409.

### Backend — robustness / correctness

16. Invalid JSON returned the raw parser message. It now returns “Request body must be valid JSON.”
17. File-type rejections from multer were plain `Error`s and surfaced as 500. They are tagged as 400.
18. The 404 handler was registered after the error handler; reordered correctly.
19. Profile `dateOfBirth` accepted impossible dates (`2026-02-31`) and let Postgres throw. It is now
    validated as a real calendar date.
20. Profile updates now bump `updated_at`.
21. A conversation lookup used `maybeSingle()` without a limit; it now limits to 1 to tolerate legacy
    duplicates.
22. Lease PDFs referenced a non-existent `property.address` column and hard-coded `$`. They now use
    `address_line1/2` and the configured currency/locale.
23. The rejection email now uses the property title (was already selected but unused).

### Frontend

24. TypeScript error: landlord application status counters lacked `EXPIRED`.
25. ESLint error: `ApplyModal` called `setState` synchronously inside an effect. Removed; the modal is
    remounted on each open.
26. Property create/edit had **no way to set latitude/longitude**, so “Near me” and distance sorting
    could never work. Added optional coordinate fields (with validation) and wired them through the
    API types.
27. Login and registration ignored `?redirectTo=` (middleware used it) and `?redirect=` (property
    page used it). Both are now honoured, restricted to same-site paths.
28. A `PROCESSING` payment offered only “Refresh status”; it now also offers “Resume payment”, which
    the API already supports by expiring the abandoned Stripe session.
29. The property edit page said “Delete … permanently” while the API archives. Copy corrected.
30. Notification dropdown followed any `link` value; it now only follows same-site paths (the
    notifications page already did).
31. Removed a stale comment claiming the units backend did not exist.
32. **Archiving a RESERVED property was allowed**, which stranded a tenant whose application had been
    approved but whose lease was not created yet. Both the landlord and admin archive paths now check
    `hasActiveReservation` (approved application or reserved/occupied unit) and return 409.
33. **The deployed `approve_application` never wrote `expires_at`** (confirmed from live rows, including
    an approval created on 2026-10-28). The fixed function is in `002_core_functions.sql`; existing
    approvals can be backfilled with `004_upgrade_existing_database.sql`.
34. **Payment amounts ignored their stored currency in the UI.** Every live payment row is
    `currency = 'usd'` (from the old schema default) while the UI formatted it as INR. The payments
    page, the tenant dashboard “next payment due” card, and the emails/PDFs now use the row’s own
    currency. The landlord/admin revenue charts still sum mixed currencies (no FX conversion).

---

## 4. Added in this pass

- `backend/sql/001_initial_schema.sql` — complete schema for a fresh project, including:
  enums, every table, foreign keys, indexes (favorites/units/reviews/live-lease/open-application),
  `updated_at` and search-vector triggers, the append-only audit trigger, and RLS default-deny.
- `backend/sql/002_core_functions.sql` — tested implementations of all six RPC functions.
- `backend/sql/003_storage_buckets.sql` — idempotent bucket creation.
- `README.md` — setup, environment, Stripe, deployment, troubleshooting.
- Tests for: rejection notification, landlord property filter, admin verification paging,
  out-of-range search totals, property coordinates, reserved-status safeguards.

---

## 5. Verification results

| Check | Result |
|---|---|
| Backend TypeScript (`tsc --noEmit`) | pass |
| Backend tests (`vitest run`) | **109 passed / 109** |
| Frontend TypeScript (`tsc --noEmit`) | pass |
| Frontend ESLint | pass |
| Frontend production build (`next build`) | pass |
| SQL schema + functions (PGlite) | pass (approval/withdraw/lease/expiry/search) |
| Migration chain 001→002→005→006→007→008 (PGlite) | pass |
| Live API public endpoints | pass |

I did **not** perform a real Stripe card payment, send a real email, or click through every screen in
a browser. Those need live credentials/test cards and are the main things to smoke-test after
deployment.

---

## 6. Needs action from you

0. **Upgrade the database functions.** In the Supabase SQL editor run
   `backend/sql/002_core_functions.sql` (safe to re-run), then review and run
   `backend/sql/004_upgrade_existing_database.sql`. Until you do, newly approved applications will
   still never expire and the “reserved until …” promise in the UI is not enforced.
1. **Rotate the secrets that were shipped in the zip.** `backend/.env` contains the Supabase
   service-role key, JWT secrets, SMTP password, and Stripe test keys. Rotate them and update `.env`.
   The file is already covered by `.gitignore`; it is included here only so the package runs.
2. **Set production URLs.** `FRONTEND_URL` on the backend and `NEXT_PUBLIC_API_URL` /
   `NEXT_PUBLIC_SOCKET_URL` on the frontend must match the deployed domains. Rebuild the frontend after
   changing `NEXT_PUBLIC_*`.
3. **Create the first admin** if your project does not have one:
   `npm run create-admin -- "Name" email "password"`.
4. **Add coordinates to existing listings.** Search/distance works, but all current properties have
   `latitude`/`longitude = null`. Edit each listing once and enter coordinates (or geocode them in SQL).
5. **Point the Stripe webhook** at the deployed API and set the signing secret.
6. **Decide on the currency** for existing unpaid invoices. New invoices use `DEFAULT_CURRENCY=INR`,
   but rows created before this fix may still have `currency = 'usd'` from the old schema default.
   Check with:
   ```sql
   select id, amount, currency, status from payments where status in ('PENDING','FAILED');
   ```
   Update them deliberately if they were meant to be INR. Also confirm your **Stripe account can
   charge INR**; if it cannot, set `DEFAULT_CURRENCY=usd` and `NEXT_PUBLIC_CURRENCY=USD` before
   creating invoices, otherwise Stripe will reject the checkout session.

---

## 7. Known limitations (not blocking, intentionally left)

- Rate limiting and the live-status cache are per-process. Use Redis before scaling horizontally.
- Reminder jobs run inside every API instance. Run one scheduler or move to a queue.
- Analytics aggregate in JS over six months (capped at 20k rows).
- No self-service “change password / change email” screen (reset-password works).
- Partial Stripe refunds are recorded as `REFUNDED` rather than a partial amount.
- Revenue analytics sum payments across currencies without FX conversion. All live rows are
  currently USD, so they are internally consistent; new invoices default to INR.
- Email templates interpolate user-supplied names/titles without HTML escaping.
- Messaging is Socket.IO-only; there is no REST fallback for sending a message.
- Admin user search caps the ID pre-filter at 50 matches per side.
