# Backend Documentation

This folder collects backend-specific architecture, data, and feature notes.

- [Architecture](./architecture.md): service structure, dependencies, route surface, and core request flows.
- [Database](../db/database.md): schema map, entity relationships, trigger behavior, and migration alignment notes.
- [Constraint audit](./constraint-audit.md): participation and event eligibility constraints.
- [Business flows](business-flows/README.md): product-flow explanations for auth, events, participation, tickets, notifications, feedback, admin, and image upload.

The migration files in [`backend/migrations/`](../../backend/migrations/) are authoritative for runtime database state. [`docs/db/schema.sql`](../db/schema.sql) is a human-readable reference snapshot and should be updated when migrations change.
