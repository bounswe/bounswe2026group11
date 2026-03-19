# bounswe2026group11
CMPE354 Group 11 repository

## Backend

Go module: [`github.com/bounswe/bounswe2026group11/backend`](https://github.com/bounswe/bounswe2026group11) (directory `backend/`; [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) layout: `internal/domain`, `internal/application`, `internal/adapter`, `infrastructure`, `pkg`).

Run the API server:

```bash
cd backend && go run ./cmd/server
```

- Health check: `GET /health` → `200 OK` (default listen address `:8080`; override with `PORT`, e.g. `PORT=3000`).

## Database

- Canonical PostgreSQL DDL (PostGIS, tables, indexes, triggers): [`docs/db/schema.sql`](docs/db/schema.sql)
- Versioned migrations ([golang-migrate](https://github.com/golang-migrate/migrate) format): `backend/migrations/`
