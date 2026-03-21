# Social Event Mapper

A **CMPE354 Group 11** project for discovering and managing social events on a map.

## Tech stack

| Layer | Technology |
|--------|------------|
| **Backend** | Go 1.26.1, [Fiber](https://gofiber.io/), PostgreSQL + PostGIS, [golang-migrate](https://github.com/golang-migrate/migrate) |
| **Frontend** | *Placeholder — under development* |
| **Mobile** | *Placeholder — under development* |

## Running locally

### Recommended: Docker Compose (API, database, nginx)

You need [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/).

1. At the repository root, create an environment file (the example values are enough to start):

   ```bash
   cp .env.example .env
   ```

2. Start the stack (from the repo root; `--project-directory .` makes Compose load the root `.env` — without it, the default project dir is `deploy/` and `.env` would be ignored):

   ```bash
   docker compose --project-directory . -f deploy/docker-compose.local.yml up --build
   ```

3. Open the app at **http://localhost**. Check the API with **http://localhost/api/health** — it should return `200`.

### API documentation (OpenAPI + Swagger UI)

Interactive API docs are served by **nginx** in the **local Docker Compose** stack, not the Go backend. The UI loads **vendored Swagger UI** assets from the repo (no CDN), so everything works **offline** once the stack is up.

Only **`docs/openapi/`** and **`docs/swagger-ui/`** are mounted into the nginx container; the rest of **`docs/`** (e.g. database or design notes) stays off the web server.

| What | URL (local Docker) |
|------|---------------------|
| **Swagger UI** | **http://localhost/api/docs/** |
| **OpenAPI specs** (YAML) | Under **http://localhost/api/docs/openapi/** (e.g. `auth.yaml`) |

- **Multiple APIs:** Specs are listed in [`docs/openapi/specs.json`](docs/openapi/specs.json). The UI shows a dropdown; you can deep-link with `?spec=<name>` (e.g. `?spec=auth`).
- **Adding a new spec:** Add a YAML file under [`docs/openapi/`](docs/openapi/) and register it in `specs.json`.

These docs routes are local-only; the remote dev deployment does not expose `/api/docs`. For the environment split, see [**Deployment → API documentation**](docs/deploy.md#api-documentation).

**Postgres (local tools):** With this compose file, the database is reachable on your machine at **127.0.0.1:5433** (mapped to container port 5432; host 5433 avoids conflicting with a local Postgres on 5432). User/database: `postgres` / `sem`; password from the root `.env`. Example: `psql -h 127.0.0.1 -p 5433 -U postgres -d sem`. On Apple Silicon you may see a harmless Docker **platform** notice if the PostGIS image runs as `linux/amd64` under emulation.

> Use [`deploy/docker-compose.local.yml`](deploy/docker-compose.local.yml) for local development. [`deploy/docker-compose.dev.yml`](deploy/docker-compose.dev.yml) is for a remote server with pre-built images; see [`docs/deploy.md`](docs/deploy.md) for details.

### Backend only (Go)

This does not run in isolation: you need a reachable PostGIS database, runtime settings from `backend/config/application.local.yaml`, and secrets in `backend/.env`.

```bash
cd backend
cp .env.example .env   # edit if needed
go run ./cmd/server
```

By default the API listens on **http://localhost:8080** (e.g. `GET /health`).

## Auth Session Behavior

The current authentication flow is username/password login with short-lived access tokens and rotated refresh tokens.

- `access_token_ttl`: **15 minutes**
- `refresh_token_ttl`: **14 days** (`336h`)
- `max_session_ttl`: **60 days** (`1440h`)

How frontend clients should use this:

1. `POST /auth/login` or `POST /auth/register/email/verify` returns both an access token and a refresh token.
2. Use the access token for authenticated API calls until it expires.
3. When the access token expires, call `POST /auth/refresh` with the latest refresh token.
4. Every successful refresh returns a **new access token** and a **new refresh token**. The previous refresh token becomes invalid immediately.
5. Each rotated refresh token lives for at most **14 days from the time it is issued**, but the full refresh-token family cannot live longer than **60 days from the original login/registration session start**.
6. Once the 60-day absolute session limit is reached, the client must send the user back through login again.

In practice, this means an active user can stay signed in without entering credentials every few days, but a session will still be forced to end after at most 60 days even if refresh calls keep succeeding before then.

## Database

Canonical DDL: [`docs/db/schema.sql`](docs/db/schema.sql) · Migrations: `backend/migrations/`
