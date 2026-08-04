# Multi-tenant platform model

Every tenant-owned record is scoped by `school_id`. Route handlers must derive that value from the authenticated JWT for school users; they must never trust a client-provided school ID. `SUPER_ADMIN` is the only role that can choose a school context.

## School lifecycle

`PENDING_APPROVAL` → `ACTIVE` → `SUSPENDED` / `SUBSCRIPTION_EXPIRED` / `REJECTED`

- Public registration creates the school and its `SCHOOL_ADMIN` user as `PENDING_APPROVAL`.
- Approval enables the school administrator and login access.
- Suspended, rejected, pending, or login-disabled schools are denied by both login and JWT middleware.
- Expired subscriptions are restricted to `/api/plans/...` billing endpoints.

## Super Admin API

- `GET /api/schools/platform/dashboard` — platform totals and recent activity
- `GET /api/schools?search=&status=&sort=&direction=` — tenant list with counts
- `PUT /api/schools/:id` — update school and branding fields
- `POST /api/schools/:id/approve`
- `POST /api/schools/:id/reject` with `{ "reason" }`
- `POST /api/schools/:id/status` with `{ "status", "loginEnabled" }`
- `POST /api/schools/:id/reset-password` with `{ "password" }`
- `GET /api/schools/:id/logs`
- `DELETE /api/schools/:id`

Use the existing `POST /api/plans/school/:schoolId/upgrade` endpoint to modify a subscription.
