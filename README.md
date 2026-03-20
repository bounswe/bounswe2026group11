# Social Event Mapper

A **CMPE354 Group 11** project for discovering and managing social events on a map.

## Tech stack

| Layer | Technology |
|--------|------------|
| **Backend** | Go 1.24, [Fiber](https://gofiber.io/), PostgreSQL + PostGIS, [golang-migrate](https://github.com/golang-migrate/migrate) |
| **Frontend** | *Placeholder — under development* |
| **Mobile** | *Placeholder — under development* |

## Running locally

### Recommended: Docker Compose (API, database, nginx)

You need [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/).

1. At the repository root, create an environment file (the example values are enough to start):

   ```bash
   cp .env.example .env
   ```

2. Start the stack:

   ```bash
   docker compose -f deploy/docker-compose.local.yml up --build
   ```

3. Open the app at **http://localhost**. Check the API with **http://localhost/api/health** — it should return `200`.

**Postgres (local tools):** With this compose file, the database is reachable on your machine at **127.0.0.1:5432** (host-only bind). Use `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from your root `.env` (same values as [`.env.example`](.env.example) unless you changed them). Example: `psql -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME"`.

> Use [`deploy/docker-compose.local.yml`](deploy/docker-compose.local.yml) for local development. [`deploy/docker-compose.dev.yml`](deploy/docker-compose.dev.yml) is for a remote server with pre-built images; see [`docs/deploy.md`](docs/deploy.md) for details.

### Backend only (Go)

This does not run in isolation: you need a reachable PostGIS database and matching settings in `.env`.

```bash
cd backend
cp .env.example .env   # edit if needed
go run ./cmd/server
```

By default the API listens on **http://localhost:8080** (e.g. `GET /health`).

## Database

Canonical DDL: [`docs/db/schema.sql`](docs/db/schema.sql) · Migrations: `backend/migrations/`
