# Ticket System

## Purpose

The backend uses a separate `ticket` entity to control physical entry for `PROTECTED` events.

A ticket is linked to a participation, but it is not the same thing as participation:

- participation answers whether a user is part of the event
- ticket answers whether that participant can present a short-lived QR token for entry
- the QR token itself is temporary access material, not the long-lived business entity

## Current Scope

The current implementation supports:

- ticket creation for approved participants of protected events
- ticket listing and detail for the ticket owner
- short-lived QR token issuance over SSE
- host-side QR scan validation
- ticket cancellation when the participant leaves
- ticket cancellation when the event is canceled
- ticket expiration when the event becomes completed

The current implementation does **not** support event-update reapproval yet.

- `PENDING` exists as a valid ticket status in the schema and domain model
- the backend does not currently transition tickets into `PENDING`
- there is no event-update flow that reopens approval for existing participants in this version

## Platform Boundary

QR-related flows are backend-supported only for the mobile client.

- `GET /me/tickets` and `GET /me/tickets/{ticketId}` are normal authenticated endpoints
- `GET /me/tickets/{ticketId}/qr-stream` requires `X-Client-Surface: MOBILE`
- `POST /host/events/{eventId}/ticket-scans` requires `X-Client-Surface: MOBILE`

This is enforced in the backend, not only documented at product level.

## Domain Model

### Participation statuses

- `APPROVED`
- `PENDING`
- `CANCELED`
- `LEAVED`

### Ticket statuses

- `ACTIVE`
- `PENDING`
- `EXPIRED`
- `USED`
- `CANCELED`

### Ticket shape

```ts
Ticket {
  id: UUID
  participationId: UUID
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "USED" | "CANCELED"
  qrTokenVersion: number
  lastIssuedQrTokenHash?: string
  expiresAt: timestamp
  usedAt?: timestamp
  canceledAt?: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Persistence Rules

- plaintext QR tokens are not stored
- only the latest issued token hash is stored
- `qrTokenVersion` is incremented every time a new QR token is issued
- old token versions are rejected during scan
- each participation can have at most one non-terminal ticket in `ACTIVE` or `PENDING`

## Current Participation to Ticket Mapping

The current backend behavior is narrower than the full original design.

| Participation transition | Current ticket behavior |
|---|---|
| protected join request approved -> `APPROVED` | create `ACTIVE` ticket |
| public direct join -> `APPROVED` | no ticket |
| participant leaves -> `LEAVED` | set ticket to `CANCELED` |
| event canceled -> `CANCELED` | set ticket to `CANCELED` |
| event completed | set unused `ACTIVE` or `PENDING` tickets to `EXPIRED` |
| successful host scan | set ticket to `USED` |

Notes:

- host internal participation rows do not get tickets
- current flows do not create `PENDING` tickets
- `USED`, `CANCELED`, and `EXPIRED` are terminal in the current implementation

## Ticket Creation Flow

Tickets are created only when a host approves a join request for a protected event.

Flow:

1. the host approves a `PENDING` join request
2. the backend creates or reactivates the participant's `APPROVED` participation
3. in the same unit of work, the backend creates an `ACTIVE` ticket

Public events do not create tickets because they do not use the protected entry flow.

## Ticket Read APIs

### `GET /me/tickets`

Returns the authenticated user's tickets with:

- ticket id
- ticket status
- ticket expiration
- event summary
- participation summary

QR tokens are never returned from this endpoint.

### `GET /me/tickets/{ticketId}`

Returns:

- ticket fields
- participation summary
- event summary
- location anchor summary
- `qr_access` state

`qr_access` is a backend-computed summary that tells the client whether the ticket is currently eligible to start QR presentation.

## QR Token Issuance

### Endpoint

`GET /me/tickets/{ticketId}/qr-stream?lat={lat}&lon={lon}`

### Current behavior

When the connection opens, the backend:

1. checks that the caller owns the ticket
2. checks that the event is `PROTECTED`
3. checks that participation is `APPROVED`
4. checks that ticket status is `ACTIVE`
5. checks that event status is `ACTIVE` or `IN_PROGRESS`
6. checks that `expiresAt` is still in the future
7. checks that the caller is within 200 meters of the event anchor
8. issues a signed token valid for 10 seconds
9. stores the new token hash and increments `qrTokenVersion`

After that, the stream emits a fresh `qr_token` event every 10 seconds.

### Current event location anchor

- if the event location type is `POINT`, the event point is used
- if the event location type is `ROUTE`, the first point of the route is used

### Current SSE behavior

The current implementation emits:

- `qr_token`
- `error`

It does not currently emit:

- `ticket_status_changed`
- `keepalive`

If a later token refresh fails, the stream emits an `error` event and stops.

### Example event

```text
event: qr_token
data: {"token":"signed-short-lived-token","expires_at":"2026-04-26T12:00:10Z","version":42}
```

## QR Token Contents

Each issued token contains:

```json
{
  "ticket_id": "uuid",
  "participation_id": "uuid",
  "event_id": "uuid",
  "user_id": "uuid",
  "version": 42,
  "issued_at": "2026-04-26T12:00:00Z",
  "expires_at": "2026-04-26T12:00:10Z"
}
```

The token is:

- signed
- short-lived
- versioned
- validated against the latest stored hash on scan

## Host Scan Flow

### Endpoint

`POST /host/events/{eventId}/ticket-scans`

Request body:

```json
{
  "qr_token": "signed-short-lived-token"
}
```

### Current validation

The backend:

1. requires the mobile client header
2. requires that the caller is the host of the event
3. verifies the token signature and expiration
4. verifies that token `event_id` matches the scanned event
5. loads the ticket in a locked transaction
6. verifies ticket and participation linkage
7. verifies the token version matches `qrTokenVersion`
8. verifies the token hash matches `lastIssuedQrTokenHash`
9. verifies ticket status is still `ACTIVE`
10. verifies participation is still `APPROVED`
11. verifies event status is still `ACTIVE` or `IN_PROGRESS`

On success:

- the ticket is marked `USED`
- `usedAt` is set
- the response returns `result: ACCEPTED`

On failure:

- the ticket state is unchanged
- the response returns `result: REJECTED`
- the response includes a machine-readable reason

### Current reject reasons

- `INVALID_TOKEN`
- `TICKET_NOT_FOUND`
- `TICKET_ALREADY_USED`
- `TICKET_NOT_ACTIVE`
- `PARTICIPATION_INVALID`
- `EVENT_INVALID`
- `TOKEN_OLD_VERSION`
- `TOKEN_NOT_LATEST`
- `EVENT_MISMATCH`
- `PARTICIPATION_MISMATCH`

## Expiration and Cancellation

### Leave event

When a participant leaves an event:

- participation becomes `LEAVED`
- the linked non-terminal ticket becomes `CANCELED`
- both happen in the same unit of work

### Cancel event

When a host cancels an event:

- the event becomes `CANCELED`
- non-leaved participations are canceled through the existing participation flow
- linked non-terminal tickets become `CANCELED`
- these changes run in the same unit of work

### Complete event / automatic event transition

When an event becomes `COMPLETED`:

- unused `ACTIVE` and `PENDING` tickets become `EXPIRED`
- `USED` tickets remain `USED`
- `CANCELED` tickets remain `CANCELED`

This happens in two places:

- explicit event completion
- the background event status transition job

## Current Limitations

- no event-update reapproval flow yet
- no current path that produces `PENDING` tickets
- the QR stream uses the location sent when the connection opens
- if the client's location changes materially, the mobile app must reconnect with new `lat` and `lon` values
- the SSE implementation currently refreshes on a fixed 10-second interval and stops on refresh error instead of sending a richer state machine

## Source of Truth

For request and response contracts, use:

- [ticket.yaml](/Users/kaanunsel/Developer/social-event-mapper/docs/openapi/ticket.yaml)

For implementation details, the current backend behavior is defined by:

- [service.go](/Users/kaanunsel/Developer/social-event-mapper/backend/internal/application/ticket/service.go)
- [ticket_handler.go](/Users/kaanunsel/Developer/social-event-mapper/backend/internal/adapter/out/httpapi/ticket_handler/ticket_handler.go)
