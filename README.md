# bounswe2026group11
CMPE354 Group 11 repository

## Backend

Go module: [`github.com/bounswe/bounswe2026group11/backend`](https://github.com/bounswe/bounswe2026group11) (directory `backend/`; [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) layout: `internal/domain`, `internal/application`, `internal/adapter`, `infrastructure`, `pkg`).

Run the API server:

```bash
cd backend
cp .env.example .env   # then edit required values (e.g. JWT_SECRET)
go run ./cmd/server
```

Configuration is loaded with [viper](https://github.com/spf13/viper): optional `backend/.env` plus environment variables (CI/CD). Env vars override the file. Required keys are listed in [`backend/.env.example`](backend/.env.example).

- Health check: `GET /health` → `200 OK` (listen port from `APP_PORT`, default `8080` if unset).

## Database

- Canonical PostgreSQL DDL (PostGIS, tables, indexes, triggers): [`docs/db/schema.sql`](docs/db/schema.sql)
- Versioned migrations ([golang-migrate](https://github.com/golang-migrate/migrate) format): `backend/migrations/`
