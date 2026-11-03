# RentEase — Property Rental & Management Platform

A full-stack rental platform for **tenants**, **landlords**, and **admins**.

- **Frontend:** Next.js 16 (App Router, React 19, Tailwind CSS 4, Socket.IO client, Recharts)
- **Backend:** Express 5 + TypeScript, Supabase (Postgres + Storage), Stripe Checkout, Nodemailer, Socket.IO
- **Database:** Supabase/Postgres with RPC functions for atomic approvals, reservations, expiry, and search

---

## 1. What is in this package

```
backend/    Express API, SQL migrations, tests
frontend/   Next.js application
README.md   this file
FIXES.md    what was audited and fixed in this pass
```

The API base path is `/api`. The browser talks only to the Express API; the Supabase service-role
key never reaches the client.

---

## 2. Prerequisites

- Node.js **20+** (tested on Node 26)
- A Supabase project (Postgres + Storage)
- Stripe **test** keys and the Stripe CLI (for local webhooks)
- An SMTP account (optional in development — emails are logged when it is missing)

---

## 3. Quick start (development)

### 3.1 Backend

```bash
cd backend
npm install
# .env is already included in this package with the working development credentials.
# For a new environment: cp .env.example .env and fill it in.
npm run dev
```

The API starts on `http://localhost:5000`. Check it with:

```bash
curl http://localhost:5000/api/health
```

For a production-style run:

```bash
npm run build
npm start
```

### 3.2 Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

`frontend/.env.local` is optional in development because the defaults point at
`http://localhost:5000`. For a deployed environment create it from `.env.example`:

```env
NEXT_PUBLIC_API_URL=https://your-api.example.com/api
NEXT_PUBLIC_SOCKET_URL=https://your-api.example.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_CURRENCY=INR
NEXT_PUBLIC_LOCALE=en-IN
```

### 3.3 First admin account

Admins cannot sign up through the public form. Create/promote one:

```bash
cd backend
npm run create-admin -- "Your Name" you@example.com "a-long-passphrase-12+"
```

Then log in at `/login`; admins are redirected to `/admin`.

---

## 4. Environment variables (backend)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | default `5000` |
| `NODE_ENV` | no | `development` / `production` |
| `FRONTEND_URL` | yes in prod | used for CORS, emails, Stripe redirects, CSRF origin check |
| `SUPABASE_URL` | yes | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server only — **never** expose it |
| `JWT_ACCESS_SECRET` | yes | long random string |
| `JWT_REFRESH_SECRET` | yes | different long random string |
| `JWT_ACCESS_EXPIRES_IN` | no | default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | no | default `7d` |
| `STRIPE_SECRET_KEY` | yes | `sk_test_...` locally |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_...` from the Stripe CLI/dashboard |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | when absent, emails are logged instead of sent |
| `EMAIL_FROM` | no | e.g. `RentEase <no-reply@example.com>` |
| `DEFAULT_CURRENCY` | no | default `INR` — new invoices use this currency |
| `DEFAULT_LOCALE` | no | default `en-IN` — money/date formatting in emails and PDFs |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 5. Database setup

### 5.1 Using the Supabase project that came with this package

The schema, storage buckets, indexes, and all six RPC functions already exist. One upgrade **is**
recommended because the deployed `approve_application` is older than the code:

- Approvals created on 2026-10-28 still have `expires_at = null`. The API and UI expect an approval
  hold (7 days by default), and the expiry cron can only release rows that have an expiry.
- Run `backend/sql/002_core_functions.sql` once (it drops + recreates the six functions with the
  current definitions, so it also works when the old return types differ).
- Then review and run `backend/sql/004_upgrade_existing_database.sql` to stamp a 7-day expiry on
  existing approvals that have no lease yet, and optionally normalise unpaid invoices to INR.

Everything else in the live project was verified: all eight storage buckets, the unique constraints
used by the API (favorites, unit labels, reviews), the notification enum values, and the admin
columns/tables from migrations 005–008.

### 5.2 Fresh Supabase project

Run these files, **in order**, in the Supabase SQL editor:

1. `backend/sql/001_initial_schema.sql` — tables, enums, indexes, triggers, RLS
2. `backend/sql/002_core_functions.sql` — the six RPC functions
3. `backend/sql/003_storage_buckets.sql` — the eight storage buckets
4. `backend/sql/005_admin_panel.sql`
5. `backend/sql/006_report_management.sql`
6. `backend/sql/007_lease_integrity.sql`
7. `backend/sql/008_audit_hardening.sql`

Migration `001` creates the schema that migrations `005`–`008` build on. On the existing project
those later migrations are already applied, so do **not** re-run `001` there.

> Storage buckets can also be created from **Storage → New bucket** in the dashboard. The two public
> buckets are `property-images` and `profile-images`; the rest must stay private.

### 5.3 Why RPC functions matter

Approving an application, reserving a unit, and releasing a hold must be atomic. Doing that with
multiple REST calls allows two landlords to approve two tenants for the same unit. The functions use
row locks and conditional updates so only one request wins; the loser gets a `409` with a readable
message.

---

## 6. Stripe setup

1. Put your test secret key in `backend/.env` as `STRIPE_SECRET_KEY`.
2. Forward webhooks locally:

   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```

3. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart the API.
4. The API handles:
   - `checkout.session.completed`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`

The webhook route is registered **before** `express.json()` and verifies the raw-body signature.
Handlers are idempotent, and a handler error returns `500` so Stripe retries.

---

## 7. Running the checks

```bash
# backend
cd backend
npx tsc -p tsconfig.json --noEmit
npm test

# frontend
cd frontend
npx tsc --noEmit
npx eslint .
npm test
npm run build
```

Current status in this package:

- backend: **109 tests passing**, TypeScript clean
- frontend: TypeScript clean, ESLint clean, production build succeeds
- SQL: schema + all functions + the full 001→008 chain validated in an embedded Postgres (PGlite)
- the installer for the six RPCs is re-runnable and was also tested against a second run

---

## 8. Feature map

| Area | Tenant | Landlord | Admin |
|---|---|---|---|
| Accounts | register, login, refresh, reset password, profile, avatar | + landlord verification (ID / ownership docs) | suspend/restore, verification queue |
| Listings | browse, search, filters, distance, favorites, reviews | create/edit/archive/restore, photos, units, coordinates | moderate, archive |
| Applications | apply (single or per-unit), upload docs, withdraw | approve/reject, view documents | read-only oversight |
| Leases | sign, download PDF, report a problem | create from approved application, sign, terminate, PDF | — |
| Payments | pay via Stripe, invoices/receipts, retry | create invoices, cancel, track | volume analytics |
| Maintenance | file with photos, cancel, track status | acknowledge, assign, complete | — |
| Messaging | real-time chat with typing/read receipts | same | — |
| Notifications | in-app bell + email | in-app + email | in-app |
| Moderation | report listing/user/lease/review | — | reports, review visibility, audit log |

---

## 9. Production notes

- Set `NODE_ENV=production` and `FRONTEND_URL=https://your-frontend` so cookies use `SameSite=None; Secure`
  and the CSRF origin check matches.
- Put the API behind HTTPS. `app.set("trust proxy", 1)` is already enabled.
- The rate limiter and the user-status cache are in-memory. Use Redis before running multiple API replicas.
- `node-cron` runs inside the API process. Run exactly one scheduler instance, or move the jobs to a
  queue/worker.
- The frontend build needs `NEXT_PUBLIC_*` variables at **build** time, not just runtime.
- `backend/.env` contains live development secrets. Rotate them before sharing this package further
  (see `FIXES.md`).

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing required environment variable` on boot | `.env` missing/incomplete |
| Login works but API calls return 401 | frontend `NEXT_PUBLIC_API_URL` points at the wrong host; cookies are per-site |
| `Could not find the function public.search_properties` | database not migrated (run `002_core_functions.sql`) |
| "Your landlord account must be verified…" | expected: verify the landlord before publishing |
| Stripe redirects back but payment stays `PROCESSING` | webhook not forwarded; run the Stripe CLI or click “Refresh status” |
| Stripe checkout fails with a currency error | new invoices use `DEFAULT_CURRENCY=INR`; make sure your Stripe account can charge INR, otherwise set `DEFAULT_CURRENCY=usd` and `NEXT_PUBLIC_CURRENCY=USD` |
| Distance search returns nothing | properties have no `latitude`/`longitude`; edit the listing and add coordinates |
| Uploads fail | bucket missing or the service-role key is wrong |
