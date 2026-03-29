# Social Event Mapper

A **CMPE354 Group 11** project for discovering and managing social events on a map.

## Tech stack

| Layer | Technology |
|--------|------------|
| **Backend** | Go 1.26.1, [Fiber](https://gofiber.io/), PostgreSQL + PostGIS, [golang-migrate](https://github.com/golang-migrate/migrate) |
| **Frontend** | [React](https://react.dev/) - maps with [MapLibre GL JS](https://maplibre.org/). |
| **Mobile** | React Native, [Expo](https://expo.dev) ~55, [Expo Router](https://docs.expo.dev/router/introduction/) |

## Repository layout

| Path | Role |
|------|------|
| [`backend/`](backend/) | Go API (`cmd/server`), domain/application layers, Postgres adapters, migrations |
| [`frontend/`](frontend/) | Web client (React + MapLibre GL planned); Compose currently uses a placeholder static image |
| [`mobile/`](mobile/) | React Native client (login, registration, API client) |
| [`deploy/`](deploy/) | Docker Compose files and env templates |
| [`docs/openapi/`](docs/openapi/) | OpenAPI 3.x specs consumed by Swagger UI and client teams |
| [`docs/db/schema.sql`](docs/db/schema.sql) | Reference DDL (migrations under `backend/migrations/` are authoritative at runtime) |

## Running locally

### Recommended: Docker Compose (API, database, nginx)

You need [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/).

1. At the repository root, create the Compose env file and fill in the required secrets (`DB_PASSWORD`, `JWT_SECRET`, and `RESEND_CLIENT_API_KEY`):

   ```bash
   cp deploy/.env.example deploy/.env
   ```

2. Start the stack from the repo root (Compose uses `deploy/` as the project directory and loads `deploy/.env` automatically):

   ```bash
   docker compose -f deploy/docker-compose.local.yml up --build
   ```

3. Open the app at **http://localhost**. Check the API with **http://localhost/api/health** — it should return `200`.

### API documentation (OpenAPI + Swagger UI)

Interactive API docs are served by **nginx** in the **local Docker Compose** stack, not the Go backend. The UI loads **vendored Swagger UI** assets from the repo (no CDN), so everything works **offline** once the stack is up.

Only **`docs/openapi/`** and **`docs/swagger-ui/`** are mounted into the nginx container; the rest of **`docs/`** (e.g. database or design notes) stays off the web server.

| What | URL (local Docker) |
|------|---------------------|
| **Swagger UI** | **http://localhost/api/docs/** |
| **OpenAPI specs** (YAML) | Under **http://localhost/api/docs/openapi/** (e.g. `auth.yaml`, `event.yaml`) |

- **Multiple APIs:** Swagger UI auto-discovers every `.yaml` or `.yml` file under [`docs/openapi/`](docs/openapi/) and shows them in the built-in dropdown. You can deep-link with `?spec=<name>` (e.g. `?spec=auth`, `?spec=event`).
- **Adding a new spec:** Add a YAML file under [`docs/openapi/`](docs/openapi/). It will appear automatically in Swagger UI the next time you load `/api/docs/`.

These docs routes are local-only; the remote dev deployment does not expose `/api/docs`. For the environment split, see [**Deployment → API documentation**](docs/deploy.md#api-documentation).

**Postgres (local tools):** With this compose file, the database is reachable on your machine at **127.0.0.1:5433** (mapped to container port 5432; host 5433 avoids conflicting with a local Postgres on 5432). User/database: `postgres` / `sem`; password from `deploy/.env`. Example: `psql -h 127.0.0.1 -p 5433 -U postgres -d sem`. On Apple Silicon you may see a harmless Docker **platform** notice if the PostGIS image runs as `linux/amd64` under emulation.

`deploy/docker-compose.dev.yml` is different: on the dev host, Postgres is published on **127.0.0.1:5432** for manual inspection and SSH tunneling, still with user `postgres`, database `sem`, and password from `deploy/.env`. That exposure is dev-only and loopback-bound, not a production pattern. If host `5432` is already in use on the dev machine, use a local Compose override file for that machine instead of changing the shared dev compose file; [`docs/deploy.md`](docs/deploy.md) shows the pattern.

> Use [`deploy/docker-compose.local.yml`](deploy/docker-compose.local.yml) for local development. [`deploy/docker-compose.dev.yml`](deploy/docker-compose.dev.yml) is for a remote server with pre-built images; see [`docs/deploy.md`](docs/deploy.md) for details.

### Backend only (Go)

This does not run in isolation: you need a reachable PostGIS database, runtime settings from `backend/config/application.local.yaml`, and secrets in the repository-root `.env` file (same keys as Compose: copy from [`deploy/.env.example`](deploy/.env.example); the Go server ignores `DOCKERHUB_NAMESPACE` if present).

```bash
cp deploy/.env.example .env   # fill in with secrets at the repository root
cd backend
go run ./cmd/server
```

By default the API listens on **http://localhost:8080** (e.g. `GET /health`). Before finishing backend changes, run **`./shipcheck.sh`** from `backend/` (format, vet, tests, integration tests).

## Authentication and sessions

### Registration and login

- **Registration** is **email OTP–based**: request an OTP, verify it, then complete account creation (username, password, optional phone). See [`docs/openapi/auth.yaml`](docs/openapi/auth.yaml) for `POST /auth/register/email/request-otp`, `POST /auth/register/email/verify`, and related routes (`check-availability`, and optional **forgot-password** OTP request).
- **Login** uses **username and password** (`POST /auth/login`) — no OTP step for sign-in.
- OTP email is delivered through the configured transactional mail provider. Local and dev defaults use **Resend**, so set `RESEND_CLIENT_API_KEY` before requesting OTPs.

### Access and refresh tokens

- `access_token_ttl`: **15 minutes**
- `refresh_token_ttl`: **14 days** (`336h`)
- `max_session_ttl`: **60 days** (`1440h`)

How clients should use this:

1. Successful registration verification (`POST /auth/register/email/verify`) or `POST /auth/login` returns both an access token and a refresh token.
2. Use the access token for authenticated API calls until it expires.
3. When the access token expires, call `POST /auth/refresh` with the latest refresh token.
4. Every successful refresh returns a **new access token** and a **new refresh token**. The previous refresh token becomes invalid immediately.
5. Each rotated refresh token lives for at most **14 days from the time it is issued**, but the full refresh-token family cannot live longer than **60 days from the original login/registration session start**.
6. Once the 60-day absolute session limit is reached, the client must send the user through login again.

In practice, an active user can stay signed in without entering credentials every few days, but a session still ends after at most 60 days even if refresh calls keep succeeding before then.

## Database

Canonical DDL: [`docs/db/schema.sql`](docs/db/schema.sql) · Migrations: `backend/migrations/`

## Further reading

- [Deployment (local vs dev droplet)](docs/deploy.md)
- [Repository conventions](docs/conventions.md)
