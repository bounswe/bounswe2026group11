# Event Management

Event behavior is centered in `event.Service`. It coordinates event persistence, participation state, join requests, tickets, notifications, badges, and event-history snapshots.

## Create Event

```mermaid
flowchart TD
    Request["POST /events"] --> Validate["Validate title, category, time, privacy, capacity, audience, tags, constraints, location"]
    Validate --> Params["Map wire DTO to CreateEventParams"]
    Params --> Tx["Persist event, event_location, event_tag, event_constraint in one transaction"]
    Tx --> History["Create initial event_history snapshot"]
    History --> Response["Return created event payload"]
```

Important rules:

- The authenticated caller becomes `host_id`.
- A host cannot reuse the same trimmed title for another event.
- `category_id` must reference `event_category`.
- `start_time` must be in the future on create.
- `POINT` events store one point; `ROUTE` events store route geometry with at least two points.
- Tags and constraints are bounded by domain limits.

## Discovery and Detail Visibility

```mermaid
flowchart LR
    Discover["GET /events"] --> PublicFilter["Only ACTIVE PUBLIC/PROTECTED"]
    PublicFilter --> Geo["PostGIS radius filter around lat/lon"]
    Geo --> Search["Optional text search and structured filters"]
    Search --> Audience["Audience eligibility filtering"]
    Audience --> Page["Cursor page"]

    Detail["GET /events/{id}"] --> Visibility{"Privacy"}
    Visibility -- PUBLIC/PROTECTED --> Readable["Readable by anyone"]
    Visibility -- PRIVATE --> PrivateCheck["Host, approved participant, or invited user only"]
    PrivateCheck --> Context["Viewer context: participation, join request, favorite, rating window"]
```

Discovery deliberately excludes `PRIVATE` events. Detail hides unreadable private events with `404 event_not_found` to avoid leaking their existence.

## Update and Reconfirmation

```mermaid
sequenceDiagram
    participant Host
    participant S as event.Service
    participant ER as EventRepository
    participant P as participation.Service
    participant T as ticket.Service
    participant N as notification.Service

    Host->>S: PATCH /events/{id}
    S->>ER: Load host-owned editable snapshot
    S->>S: Validate update and detect changed fields
    S->>ER: Update event and increment version when needed
    S->>ER: Create event_history snapshot
    alt Reconfirmation-triggering change
        S->>P: Mark approved non-host participations PENDING
        S->>T: Mark active tickets PENDING
        S->>N: Send EVENT_RECONFIRMATION_REQUIRED
    end
    S-->>Host: Updated event, version, changed fields
```

Reconfirmation-triggering changes include title, description, category, location/address/geometry/route, start/end time, and newly added constraints. Removing constraints alone does not require reconfirmation.

Participants call `POST /events/{id}/participation/reconfirm` to move from `PENDING` back to `APPROVED` for the current `event.version_no`. Pending tickets are activated with the participation.

## Cancellation and Completion

```mermaid
stateDiagram-v2
    [*] --> ACTIVE
    ACTIVE --> IN_PROGRESS: background job sees start_time reached
    ACTIVE --> CANCELED: host/admin cancels
    ACTIVE --> COMPLETED: host/admin completes or end_time reached
    IN_PROGRESS --> COMPLETED: host/admin completes or end_time reached
    IN_PROGRESS --> CANCELED: host/admin cancels
```

Cancellation cascades operational state:

- event status becomes `CANCELED`
- approved participant count is snapshotted
- participations are canceled
- pending invitations and join requests are canceled
- active/pending tickets are canceled
- affected users receive event notifications when notification service is available

Completion allows ratings and review comments according to their event-specific mutation windows.

## Background Status Transition Job

`Container.StartEventExpiryJob` runs every minute. It advances event statuses, expires/activates related tickets as needed, and evaluates participation badges for newly completed events.
