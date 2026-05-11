# Backend Business Flows

This folder explains backend behavior from a product-flow perspective. Use these documents when you need to understand how routes, services, database rows, notifications, tickets, and background jobs work together.

| Flow | Scope |
| --- | --- |
| [Auth and sessions](./auth-and-sessions.md) | Registration OTP, login, refresh-token rotation, logout, password reset, and role claims. |
| [Event management](./event-management.md) | Event creation, discovery/detail visibility, update versioning, reconfirmation, cancellation, and completion. |
| [Participation access](./participation-access.md) | Public joins, protected join requests, private invitations, capacity/eligibility checks, and leave/cancel behavior. |
| [Tickets and check-in](./tickets-and-check-in.md) | Ticket creation, QR token streaming, host scans, ticket state changes, and lifecycle coupling. |
| [Notifications and badges](./notifications-and-badges.md) | In-app notifications, SSE, push delivery, retention, and badge evaluation. |
| [Social feedback](./social-feedback.md) | Discussion comments, review comments, event ratings, participant ratings, reports, and score updates. |
| [Admin panel](./admin-panel.md) | ADMIN-only operational lists and controlled mutations. |
| [Image upload](./image-upload.md) | Direct-upload contract and confirmation behavior. |

Migration files and application services remain the source of truth. These docs are an orientation layer for readers of the repo.
