# RentEase – security & scalability review (frontend + backend, verified from code)

Reviewed: `frontend-glass` (Next.js 16) and `backend` (Express 5, Supabase, Stripe, Socket.IO).
Items marked **FIXED** are patched in the delivered code; **OPEN** items still need work.

## 0. Corrections to my first (frontend-only) pass
- Forgot/reset-password **did exist** in the API, but (a) the reset email was never sent – the token was only `console.log`-ed – and (b) the API field is `newPassword`, not `password`. Both fixed.
- Ownership checks are **consistently present** (applications, leases, payments, maintenance, conversations, documents). My "IDOR everywhere" warning was too pessimistic – the pattern is good; keep it and add tests.
- Stripe webhook **does** verify the signature on the raw body. Good.
- No `users.is_verified` was ever set anywhere – landlord verification had no reviewer. The admin panel closes that.

## 1. Vulnerabilities found in the backend

### Critical / High
| # | Finding | Status |
|---|---|---|
| 1 | **`.env` with real secrets shipped in the zip** (Supabase service-role key, JWT secrets, SMTP password, Stripe test key + webhook secret). | **ACTION NEEDED:** rotate *all* of them now (also check git history). The fixed package still includes `.env` so it runs out of the box; `.gitignore` and `.env.example` are present, and the README/FIXES repeat the warning. Remove `.env` before sharing the zip. |
| 2 | **Suspension did nothing**: `is_suspended` only checked at login/refresh, no way to set it, access tokens valid 15 min after. | **FIXED** – admin suspension + `requireAuth` live status check + token/socket revocation. |
| 3 | **Landlord could activate a lease alone** (`DRAFT→ACTIVE` via `PATCH /leases/:id/status`) with no tenant signature, then invoice the tenant. | **FIXED** – ACTIVE requires both signatures. |
| 4 | **Signing race**: tenant and landlord signing simultaneously could leave a lease stuck in DRAFT with both signed (read-modify-write). | **FIXED** – per-party write, then conditional activation. |
| 5 | **Webhook returned 200 on handler errors** → a transient DB failure silently lost a successful payment (Stripe never retried). | **FIXED** – returns 500 so Stripe retries (handlers are idempotent). |
| 6 | **Refresh-token race/replay**: check-then-update allowed two parallel refreshes; replay of a used token wasn't treated as theft. | **FIXED** – atomic claim + revoke-all-sessions on reuse. |
| 7 | **No rate limiting** on login/register/reset. | **FIXED (basic)** – in-memory limiter; replace with Redis store for multi-instance. |
| 8 | **Login enumeration**: unknown email skipped bcrypt (timing oracle) and suspended state was revealed before the password check. | **FIXED**. |
| 9 | **Error handler leaked internals**: 5xx returned raw `err.message` (Postgres/Supabase text). | **FIXED**. |
| 10 | **CSRF on `/auth/refresh` & `/auth/logout`** (cookie `SameSite=None` in prod). | **FIXED** – Origin must equal `FRONTEND_URL`. |
| 11 | **`POST /leases` without `applicationId`** lets a landlord create a lease (and later invoices + notifications) for *any* user id. | **FIXED** – a lease can only be created from an APPROVED application whose reservation is still valid. |
| 12 | **Hard delete of properties** (`deleteProperty`) – if FKs cascade, lease/payment history disappears. | **FIXED** – delete archives; restore is explicit. Financial tables are never hard-deleted by the app. |

### Medium
- **JWT** verify did not pin the algorithm – **FIXED** (HS256 pinned). Consider `iss`/`aud` claims.
- **Uploads trust client MIME type** (multer `mimetype`) – **FIXED**: magic-byte sniffing middleware runs after multer; per-user document quota is enforced. EXIF stripping is still not done.
- **`POST /documents/:category` accepts `LEASE_DOCUMENT` and `RECEIPT`** from any user → forgeable "receipts". | **FIXED** – only `USER_DOCUMENT` is client-uploadable; receipts and leases are generated server-side.
- **Storage paths use `Date.now()`** (collisions → upload failures). | **FIXED** – UUID paths everywhere.
- **ID/tax numbers stored in plaintext** (`government_id_number`, `tax_id`). **OPEN**: column encryption; admin list view never returns them (done).
- **Verification documents**: signed URL TTL 1 h elsewhere; admin panel uses 5 min. Make sure the `verification-documents` bucket is **private**.
- **Payments**: abandoned checkout leaves an invoice in `PROCESSING` up to 24 h (tenant can't retry); no duplicate-invoice guard (add unique `(lease_id, type, period)`); partial refunds are marked `REFUNDED`; `/sync` calls Stripe on every hit (throttle).
- **Socket.IO**: no per-event rate limits; JWT not re-validated after connect (suspension now disconnects sockets).
- Emails format money as `$` – use the payment's currency.
- No tests, no CI, no audit log before this change (now: `audit_log` for all admin actions).

## 2. Why it will not scale as-is
| Bottleneck | Evidence in code | Change |
|---|---|---|
| **N+1 unread counts** | `listConversations` runs one `count` query per conversation | single SQL view / `unread_count` via lateral join or a counter column |
| **Unbounded lists** | `listMine*`, `listLandlord*`, `listForLandlord`, notifications, conversations return everything | pagination (keyset for feeds/messages) |
| **`count: "exact"` on big tables** | admin & search endpoints | estimated counts / cached totals |
| **Cron in every instance** | `node-cron` in `index.ts` → duplicate reminders with >1 replica | BullMQ repeatable jobs or a single scheduler; idempotency via `rent_reminder_sent_at` (already there – make the update atomic) |
| **Emails & PDFs on the request path** | fire-and-forget `send()`, `pdfkit` per download | queue + retries; cache generated PDFs in Storage |
| **Socket.IO in memory** | single `io` instance, `getIO()` singleton | Redis adapter + sticky sessions |
| **Per-process caches** | rate limiter, user-status cache | Redis |
| **Analytics in JS** | `getStats` aggregates 6 months of rows in Node | SQL views / rollup tables refreshed by a job |
| **DB** | no pooler/indexes documented | transaction pooler, indexes (SQL file adds the admin ones), PostGIS for distance, `tsvector`/Typesense for search, partition `messages`/`notifications`/`audit_log` |
| **Frontend** | all pages client-fetched, no SSR for public listings, 600 KB three.js, raw `<img>` | Server Components + ISR for `/` `/properties`, TanStack Query, `next/image`, lazy charts |
| **Ops** | no Docker/CI/observability | Docker, CI (typecheck, lint, `npm audit`, tests), pino + Sentry, health/readiness, backups with tested restore |

### Growth path (rules of thumb – measure)
1. **≤ ~10k users:** current monolith + items above marked FIXED/OPEN-critical, pagination, indexes, pooler.
2. **~10k–100k:** Redis (cache, limiter, socket adapter), BullMQ workers, read replica, CDN images, search index, payments ledger + reconciliation.
3. **100k+:** split realtime gateway + workers into separate deployables; stay a modular monolith for core domain until team size forces a split.

## 3. Priority order
1. Rotate every secret in the shipped `.env` → run `005_admin_panel.sql` → create admin → deploy fixes.
2. OPEN #11, #12, upload hardening, document-category restriction.
3. Pagination + N+1 fix + indexes → Redis/queue → SSR/data layer.
4. Tests for authorization (call each `/:id` endpoint as a different user) and for webhooks.
