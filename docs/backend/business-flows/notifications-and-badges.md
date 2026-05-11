# Notifications and Badges

Notifications and badges are cross-cutting services. Domain flows call them after primary mutations so clients receive updates and users earn progress markers.

## Notification Fanout

```mermaid
flowchart TD
    Domain["Domain action"] --> Service["notification.Service"]
    Admin["Admin custom send"] --> Service
    Service --> Inbox["notification row"]
    Service --> Broker["Realtime broker"]
    Broker --> SSE["/me/notifications/stream"]
    Service --> Devices["Active user_push_device rows"]
    Devices --> FCM["Firebase push sender"]
    FCM --> Attempts["notification_delivery_attempt"]
```

Common notification sources:

- invitation created, accepted, declined, or revoked
- protected join request created, approved, rejected, or canceled
- event update requires reconfirmation
- event canceled or completed
- admin custom notification

Notification delivery usually should not roll back the original business mutation. The exception is when notification sending is itself the requested admin operation.

## In-App Inbox

```mermaid
flowchart LR
    List["GET /me/notifications"] --> Visible["deleted_at IS NULL"]
    Unread["GET /me/notifications/unread"] --> ReadFilter["is_read = false"]
    MarkOne["PATCH /me/notifications/{id}/read"] --> ReadAt["set is_read/read_at"]
    MarkAll["PATCH /me/notifications/read"] --> ReadAll["mark all visible as read"]
    DeleteOne["DELETE /me/notifications/{id}"] --> SoftDelete["set deleted_at"]
    DeleteAll["DELETE /me/notifications"] --> SoftDeleteAll["soft-delete visible rows"]
```

`notification.deleted_at` gives clients deletion semantics without requiring immediate hard deletes. A retention job later removes expired rows.

## Push Devices

```mermaid
sequenceDiagram
    participant C as Client app
    participant H as notification_handler
    participant S as notification.Service
    participant R as NotificationRepository

    C->>H: PUT /me/push-devices/{installation_id}
    H->>S: RegisterDevice(user_id, platform, fcm_token)
    S->>R: Upsert active installation and revoke duplicate active token if needed
    H-->>C: 204
    C->>H: DELETE /me/push-devices/{installation_id}
    H->>S: UnregisterDevice
    S->>R: Set revoked_at
```

Auth logout and admin deactivation can revoke push devices so stale sessions stop receiving push notifications.

## Badge Evaluation

```mermaid
flowchart TD
    Participation["Participation completed/created"] --> ParticipationBadges["EvaluateParticipationBadges"]
    Hosting["Hosted event completed or score changes"] --> HostBadges["EvaluateHostBadges"]
    Favorites["Favorite location saved"] --> SocialBadges["EvaluateFavoriteLocationBadges"]
    Startup["Server startup"] --> Backfill["BackfillExistingBadges"]

    ParticipationBadges --> Award["Award missing user_badge rows"]
    HostBadges --> Award
    SocialBadges --> Award
    Backfill --> Award
```

Badge writes are idempotent because `user_badge` has a `(user_id, badge_id)` primary key. The catalog is seeded by migration and exposed through badge endpoints.

## Retention and Localization

- `StartNotificationRetentionJob` runs daily and deletes expired notification rows.
- Notification text is rendered using the recipient locale at creation time.
- Error responses use request locale resolution; notification rows do not retranslate when a user later changes locale.
