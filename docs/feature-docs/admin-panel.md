# Admin Panel Analysis

## Purpose

The admin panel is a web-only backoffice surface for users with the `ADMIN` role. Admin users should see an `Admin Panel` button in the top-right web header next to the profile button. The button routes to `/backoffice`. Mobile must not expose this entry point.

The panel should let admins inspect operational data with simple, image-free row lists and perform two controlled operations:

- send custom in-app or push notifications to selected users
- create, cancel, and inspect manual participations

## Current Repository State

### Backend

- The backend is a Go/Fiber service using clean/hexagonal layers:
  - domain models under `backend/internal/domain/`
  - application services under `backend/internal/application/`
  - Postgres adapters under `backend/internal/adapter/in/postgres/`
  - HTTP handlers under `backend/internal/adapter/out/httpapi/`
  - route registration in `backend/internal/server/http.go`
- Authentication currently verifies JWTs through `httpapi.RequireAuth`.
- Access token claims currently include user id, username, and email, but not a role.
- `app_user` has no role column today. Admin authorization needs a persisted role, preferably uppercase values such as `USER` and `ADMIN`.
- Existing notification application service already supports `SendNotificationToUsers` and `SendPushToUsers`, which can be reused by an admin HTTP endpoint after authorization and validation.
- Existing participation logic supports direct public joins and leave/cancel flows, but admin manual participation creation/cancellation needs separate application behavior so normal user join restrictions are not accidentally reused or bypassed in unclear ways.
- Existing OpenAPI specs live under `docs/openapi/`; admin contract changes should be documented there.

### Frontend

- The web app is React with React Router.
- Main routes are registered in `frontend/src/App.tsx`.
- The shared web shell/header is `frontend/src/components/AppShell.tsx`.
- Auth state is held in `frontend/src/contexts/AuthContext.tsx`; it currently stores token, refresh token, username, avatar URL, and display name, but not user role.
- API helpers live in `frontend/src/services/api.ts`; domain service wrappers are in `frontend/src/services/*Service.ts`.
- Mobile is a separate app under `mobile/` and should not be changed for this feature.

## Proposed Backend Shape

Add an admin/backoffice HTTP surface under an authenticated admin-only route group such as `/admin` or `/backoffice/api`. The public frontend route remains `/backoffice`; API paths should be documented in OpenAPI.

Recommended backend work:

- Add a `role` field to `app_user` with default `USER`.
- Add domain role constants with uppercase serialized values: `USER`, `ADMIN`.
- Include role in auth session responses and JWT access-token claims.
- Add `RequireAdmin` middleware or an equivalent route wrapper that verifies authenticated claims carry `ADMIN`.
- Add offset pagination for admin list endpoints using `limit` and `offset`.
- Keep responses lightweight and row-oriented; do not return image payloads except existing URL strings when needed for identification.
- Add OpenAPI documentation under `docs/openapi/`.
- Add unit and integration tests for authorization, filters, pagination, and admin mutations.

Recommended admin list endpoints:

- `GET /admin/users`
  - Filters: query text, status, role, created date range.
  - Rows: id, username, email, phone number, role, status, email verified flag, created_at, updated_at.
- `GET /admin/events`
  - Filters: query text, host id, category id, privacy level, status, start date range.
  - Rows: id, title, host id/username, category, privacy level, status, start_time, end_time, capacity, approved/pending counts, created_at.
- `GET /admin/tickets`
  - Filters: query text, status, event id, user id, participation id, created date range.
  - Rows: ticket id, status, participation id, event id/title, user id/username, expires_at, used_at, created_at.
- `GET /admin/participations`
  - Filters: query text, status, event id, user id, created date range.
  - Rows: participation id, status, event id/title, user id/username, created_at, updated_at.

Recommended admin mutation endpoints:

- `POST /admin/notifications`
  - Inputs: user_ids, delivery target (`IN_APP`, `PUSH`, or `BOTH`), title, body, optional type, optional deep_link, optional data.
  - Behavior: create in-app notifications and/or trigger push delivery for the selected users through the existing notification service.
  - Response: target user count, created count, SSE count, push sent/failed counts, invalid-token count.
- `POST /admin/participations`
  - Inputs: event_id, user_id, optional status defaulting to `APPROVED`, optional reason/note for auditability if audit logging is added.
  - Behavior: creates or reactivates a participation according to explicit admin rules. It should validate that event and user exist, prevent duplicate active participation, update participant counters consistently, and create/cancel protected-event tickets when required by existing ticket lifecycle rules.
- `POST /admin/participations/{participation_id}/cancel`
  - Inputs: optional reason.
  - Behavior: marks the participation `CANCELED`, updates event counters, cancels linked active/pending tickets, and is idempotent for already-canceled rows where possible.

## Proposed Frontend Shape

Add a web-only backoffice route under `/backoffice` inside the React frontend.

Recommended frontend work:

- Extend auth models/context to store the authenticated user role from auth responses.
- Show `Admin Panel` next to the profile button in the top-right web header only when `role === 'ADMIN'`.
- Add a protected admin route guard so non-admin users cannot access `/backoffice`.
- Add a fixed left sidebar in the backoffice with these sections:
  - Users
  - Events
  - Participations
  - Tickets
  - Notifications
- Use dense, simple list views with table rows and no images.
- Use offset pagination controls backed by backend `limit` and `offset` parameters.
- Add basic filters per entity matching the backend filters.
- Keep the panel isolated from mobile and from regular user-facing navigation.

Recommended pages:

- `/backoffice/users`: filterable user table.
- `/backoffice/events`: filterable event table.
- `/backoffice/participations`: filterable participation table plus create/cancel actions.
- `/backoffice/tickets`: filterable ticket table.
- `/backoffice/notifications`: user targeting controls and custom notification form for in-app or push delivery.

## Delivery Plan

The work should be split by deployable surface:

1. Backend admin foundation and read-only list APIs.
2. Backend admin notification and manual participation mutations.
3. Frontend admin entry point, route guard, shell, sidebar, and read-only list views.
4. Frontend admin notification and participation action pages.

This sequencing lets backend contracts land first, then the read-only panel, then operational admin actions.
