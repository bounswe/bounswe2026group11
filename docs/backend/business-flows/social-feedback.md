# Social Feedback

Social feedback covers event discussion, completed-event review comments, event ratings, participant ratings, favorite events/locations, and event reports.

## Discussion Comments

```mermaid
flowchart TD
    Read["GET /events/{id}/comments"] --> Visibility["Event readability check"]
    Visibility --> Page["Cursor page of top-level discussion and review comments"]
    Replies["GET /events/{id}/comments/{commentId}/replies"] --> ReplyPage["Cursor page of direct replies"]
    Write["POST /events/{id}/comments"] --> Writable["Writable discussion context"]
    Writable --> Parent{"parent_id?"}
    Parent -- no --> TopLevel["Create top-level DISCUSSION"]
    Parent -- yes --> Reply["Create one-level reply"]
```

Database triggers enforce that replies belong to the same event, target a discussion comment, and do not create nested replies. `event_comment.reply_count` and `likes_count` are trigger-maintained counters.

## Review Comments

`POST /events/{id}/review-comments` creates or updates the caller's completed-event review comment. Review comments:

- require the event to be completed
- require the caller to be an approved participant
- are one per `(event_id, user_id)`
- can include a confirmed review image upload token
- carry a rating from 1 to 5

When a review changes, `comment.Service` refreshes the host's rating summary through the rating service.

## Ratings

```mermaid
flowchart LR
    EventRating["PUT /events/{id}/rating"] --> EventWindow["Participant rating window check"]
    EventWindow --> EventUpsert["Upsert event_rating"]
    EventDelete["DELETE /events/{id}/rating"] --> EventRemove["Delete caller event_rating"]

    ParticipantRating["PUT /events/{id}/participants/{participantUserId}/rating"] --> HostCheck["Caller must be host"]
    HostCheck --> ParticipantWindow["Participant rating window check"]
    ParticipantWindow --> ParticipantUpsert["Upsert participant_rating"]
    ParticipantUpsert --> Score["Refresh user_score"]
```

Event ratings are submitted by participants for completed events. Participant ratings are submitted by hosts for participants. Both use bounded rating/message validation and time-window checks.

## Favorites

```mermaid
flowchart TD
    AddEvent["POST /events/{id}/favorite"] --> FavoriteEvent["Insert favorite_event"]
    RemoveEvent["DELETE /events/{id}/favorite"] --> DeleteFavoriteEvent["Delete favorite_event"]
    FavoriteEvent --> FavoriteCount["sync_favorite_count trigger updates event.favorite_count"]

    SaveLocation["POST /me/favorite-locations"] --> FavoriteLocation["Insert favorite_location point/name/address"]
    FavoriteLocation --> Badge["Evaluate favorite-location badges"]
```

Favorite events are event-scoped. Favorite locations are user-owned saved places backed by PostGIS points.

## Event Reports

```mermaid
sequenceDiagram
    participant U as User
    participant H as event_report_handler
    participant S as eventreport.Service
    participant I as imageupload.Service
    participant R as EventReportRepository

    U->>H: POST /events/{id}/reports
    H->>S: CreateEventReport
    S->>S: Validate category/message and readable report context
    opt image confirm token
        S->>I: ConfirmEventReportImageUpload
    end
    S->>R: Insert event_report with PENDING status
    H-->>U: report result
```

Admins moderate reports through `/admin/event-reports` and can move statuses among `PENDING`, `REVIEWED`, and `DISMISSED`.
