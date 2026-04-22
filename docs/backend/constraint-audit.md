# Backend Participation & Event Constraint Audit — Issue #467

_Last updated: 2026-04-19_

| Constraint                               | Stored in                    | Enforced server-side?          | Enforcement location                                    | Test reference                         |
|------------------------------------------|------------------------------|--------------------------------|---------------------------------------------------------|----------------------------------------|
| Capacity (approved ≤ capacity)           | `event.capacity`             | ✅ Yes                          | `event.Service.JoinEvent`, `join_request_repo.ApproveJoinRequest` | `service_test.TestJoinEventRejectsFullCapacity` |
| Host cannot join                         | `event.host_id`              | ✅ Yes                          | `event.Service.JoinEvent`, `event.Service.RequestJoin`  | `TestJoinEventRejectsHost`             |
| Privacy level (PUBLIC vs PROTECTED)      | `event.privacy_level`        | ✅ Yes                          | `event.Service.JoinEvent`, `event.Service.RequestJoin`  | `TestJoinEventRejectsProtectedEvent`   |
| Event status (not CANCELED/COMPLETED)    | `event.status`               | ✅ Yes                          | `event.Service.JoinEvent`, `event.Service.RequestJoin`, `event.Service.ApproveJoinRequest` | _existing coverage_ |
| Duplicate participation / pending request| `participation`, `join_request` | ✅ Yes (repo)                | `participation_repo`, `join_request_repo`               | _existing coverage_                    |
| Rejection cooldown (72h)                 | `join_request.updated_at`    | ✅ Yes                          | `join_request_repo.handleExistingJoinRequestForCreate`  | _existing coverage_                    |
| Minimum age                              | `event.minimum_age`          | ✅ Yes                          | `domain.CheckParticipationEligibility` called from `event.Service.JoinEvent`, `event.Service.RequestJoin` | `TestJoinEventRejectsUnderageUser`, `TestRequestJoinRejectsUnderageUser`, `TestIntegrationJoinEventRejectsUnderageUser` |
| Preferred gender                         | `event.preferred_gender`     | ✅ Yes                          | `domain.CheckParticipationEligibility` called from `event.Service.JoinEvent`, `event.Service.RequestJoin` | `TestJoinEventRejectsMismatchedGender`, `TestRequestJoinRejectsMismatchedGender`, `TestIntegrationRequestJoinRejectsMismatchedGender` |
| **Language restrictions**                | `event_constraint` (free-form)| ⚠️ Not structurally enforceable (no language field on user) | — | _follow-up issue_ |
| Start time must be in future             | `event.start_time`           | ✅ Yes                          | `validateCreateEventInput` in `event.Service.CreateEvent` | `TestCreateEventValidationPastStartTime` |

## Decisions

- Eligibility checks live in a pure domain helper (`domain.CheckParticipationEligibility`), not inlined in `JoinEvent` / `RequestJoin`, so REST handlers, future admin APIs, and background jobs share one implementation.
- When a restricted event requires a gender/birthdate that the requester has not set, the server returns 400 `profile_incomplete` rather than silently bypassing the check.
- Language restrictions require a schema change (user language field + typed constraint rows); tracked in a separate follow-up issue.
