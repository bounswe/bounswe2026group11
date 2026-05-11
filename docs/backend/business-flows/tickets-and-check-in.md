# Tickets and Check-In

Tickets model event entry for protected/private access flows and are managed by `ticket.Service`.

## Ticket Creation

```mermaid
flowchart TD
    Approved["Participation becomes APPROVED"] --> NeedTicket{"Ticketed access required?"}
    NeedTicket -- yes --> Create["ticket.Service.CreateTicketForParticipation"]
    Create --> Active["ticket.status = ACTIVE"]
    NeedTicket -- no --> NoTicket["No ticket row"]
```

Tickets are linked to `participation.id`. The database permits at most one non-terminal ticket (`ACTIVE` or `PENDING`) per participation.

## QR Token Stream

```mermaid
sequenceDiagram
    participant U as Participant
    participant H as ticket_handler
    participant S as ticket.Service
    participant M as TicketTokenManager

    U->>H: GET /me/tickets/{ticketId}/qr-stream
    H->>S: StreamQRToken(user_id, ticket_id)
    loop short interval
        S->>M: Issue short-lived QR token
        S->>S: Store last issued token hash/version
        H-->>U: SSE token event
    end
```

The QR token TTL is intentionally short. The backend stores token hashes, not reusable plaintext token values.

## Host Scan

```mermaid
sequenceDiagram
    participant Host
    participant H as ticket_handler
    participant S as ticket.Service
    participant R as TicketRepository

    Host->>H: POST /host/events/{eventId}/ticket-scans
    H->>S: ScanTicket(host_id, event_id, qr_token)
    S->>S: Verify token signature, expiry, and event binding
    S->>R: Load active ticket and participation context
    S->>S: Confirm requester is host and ticket is usable
    S->>R: Mark ticket USED
    H-->>Host: scan result
```

Scan rejects wrong-event tokens, expired tokens, non-host callers, terminal tickets, and already-used tickets.

## Ticket Lifecycle Coupling

```mermaid
stateDiagram-v2
    [*] --> ACTIVE
    ACTIVE --> PENDING: event update requires reconfirmation
    PENDING --> ACTIVE: participant reconfirms current event version
    ACTIVE --> USED: host scan succeeds
    ACTIVE --> CANCELED: leave/cancel/deactivate
    PENDING --> CANCELED: leave/cancel/deactivate
    ACTIVE --> EXPIRED: event access window closes
    PENDING --> EXPIRED: event access window closes
```

Event and participation flows call ticket lifecycle methods so ticket state stays aligned with membership state.

## Client Surfaces

- Participants list their tickets with `GET /me/tickets`.
- Participants inspect one ticket with `GET /me/tickets/{ticketId}`.
- Participants stream short-lived QR tokens with `GET /me/tickets/{ticketId}/qr-stream`.
- Hosts scan with `POST /host/events/{eventId}/ticket-scans`.
