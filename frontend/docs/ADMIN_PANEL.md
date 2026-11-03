# Admin panel – setup & reference

## 1. Database
On the existing Supabase project, `backend/sql/005_admin_panel.sql` has already been applied. For a
fresh project run the base schema first (`001_initial_schema.sql`), then `002_core_functions.sql`,
`003_storage_buckets.sql`, and finally `005`–`008`. See the root `README.md`.
If `notifications.type` is an enum, it must include `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`,
`REPORT_UPDATED`, `APPROVAL_EXPIRED`, `RESERVATION_RELEASED`, and `LEASE_ENDED` (the bundled schema
includes all of them).

## 2. Create the first admin (never possible via public signup)
```bash
cd backend
npm run create-admin -- "Your Name" you@example.com "a-long-passphrase-12+"
```
Then log in at `/login` – admins land on `/admin`.

## 3. What the panel does
| Page | Route | Backend | Notes |
|---|---|---|---|
| Overview + analytics | `/admin` | `GET /api/admin/stats` | counts, 6-month signups, payment volume, recent activity |
| Users | `/admin/users` | `GET /users`, `PATCH /users/:id/suspension` | search/filter; suspend revokes refresh tokens, kills live sockets, blocks API access within seconds |
| Landlords / verification | `/admin/verifications` | `GET /verifications`, `PATCH /verifications/:id` | approve sets `users.is_verified`; ID docs via 5-minute signed URLs; ID/tax numbers never listed |
| Properties | `/admin/properties` | `GET /properties`, `PATCH /properties/:id/status` | archive / restore listings |
| Applications | `/admin/applications` | `GET /applications` | read-only oversight |
| Reports & complaints | `/admin/reports` | `GET /reports`, `PATCH /reports/:id` | complaints, flagged reviews, listing reports |
| Reviews | `/admin/reviews` | `GET /reviews`, `PATCH /reviews/:id/visibility` | hide/restore |
| Audit log | `/admin/audit` | `GET /audit` | who did what, every admin action |

All routes: `/api/admin/*` behind `requireAuth` + `requireRole("ADMIN")`. `requireAuth` now re-reads role and
suspension from the DB (30 s cache), so a demoted or suspended admin loses access almost immediately.

## 4. User-facing endpoints added so the queues have data
- `POST /api/reports` `{kind, targetType?, targetId?, subject, details?}` – any signed-in user (10/hour).
- `POST /api/reviews` `{propertyId, rating 1-5, body?}` – tenants with a lease on that property, one per property.
- `GET /api/reviews/property/:propertyId` – public, hidden reviews excluded.
The tenant UI now has the report dialog and review form wired to these endpoints.

## 5. Known gaps
- Analytics aggregate in JS over the last 6 months (capped at 20k rows). Fine for early stage; move to SQL views/rollups as data grows.
- Rate limiting is in-memory (single instance). Use a Redis store before running replicas.
