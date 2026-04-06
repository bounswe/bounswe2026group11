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
| [`deploy/`](deploy/) | Docker Compose files and env templates (`IMAGE_TAG` selects the deployed app image tag on the dev server) |
| [`nginx/`](nginx/) | Local and dev reverse proxy configuration |
| [`docs/openapi/`](docs/openapi/) | OpenAPI 3.x specs consumed by Swagger UI and client teams |
| [`docs/db/schema.sql`](docs/db/schema.sql) | Reference DDL (migrations under `backend/migrations/` are authoritative at runtime) |

## Local development

### Recommended: Docker Compose

You need [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/).

1. At the repository root, create the Compose env file and fill in the required secrets (`DB_PASSWORD`, `JWT_SECRET`, and `RESEND_CLIENT_API_KEY`):

   ```bash
   cp deploy/.env.example deploy/.env
   ```

2. Start the local stack from the repo root:

   ```bash
   docker compose -f deploy/docker-compose.local.yml up --build
   ```

3. Open:
   - App: `http://localhost`
   - API health: `http://localhost/api/health`
   - Swagger UI: `http://localhost/api/docs/`

The local compose stack includes:

- Backend API
- Frontend
- Postgres/PostGIS
- Nginx
- Local Swagger UI backed by [`docs/openapi/`](docs/openapi/)

Useful local details:

- Postgres is exposed at `127.0.0.1:5433` for local tools.
- The dev-server compose file is different: [`deploy/docker-compose.dev.yml`](deploy/docker-compose.dev.yml) is for the remote droplet, not local development.
- API docs are local-only; the shared dev deployment does not expose `/api/docs`.

`deploy/docker-compose.dev.yml` is different: on the dev host, Postgres is published on **127.0.0.1:5432** for manual inspection and SSH tunneling, still with user `postgres`, database `sem`, and password from `deploy/.env`. That exposure is dev-only and loopback-bound, not a production pattern. If host `5432` is already in use on the dev machine, use a local Compose override file for that machine instead of changing the shared dev compose file; [`docs/deploy.md`](docs/deploy.md) shows the pattern.

> Use [`deploy/docker-compose.local.yml`](deploy/docker-compose.local.yml) for local development. [`deploy/docker-compose.dev.yml`](deploy/docker-compose.dev.yml) is for a remote server with pre-built images; see [`docs/deploy.md`](docs/deploy.md) for details.

## Remote dev deployment

The shared development server is deployed by GitHub Actions workflow [`deploy-dev.yml`](.github/workflows/deploy-dev.yml).

- **Automatic trigger:** pushes/merges to `main`
- **Manual trigger:** `workflow_dispatch` from the GitHub Actions UI
- **Image strategy:** backend and frontend images are pushed to Docker Hub with both `latest` and an immutable commit-SHA tag; the server deploys the exact `IMAGE_TAG` written into `deploy/.env`
- **Safe update behavior:** the workflow pulls and recreates only the application services by default, waits for Postgres health before updating the backend, and avoids unnecessary Postgres restarts; if nginx is already running, it reloads the config instead of recreating the container

This is intentionally separate from the `dev` branch workflow. PRs still target `dev` for integration, but the shared dev droplet is updated from `main`.

### Backend only (Go)

This does not run in isolation: you need a reachable PostGIS database, runtime settings from `backend/config/application.local.yaml`, and secrets in the repository-root `.env` file (same keys as Compose: copy from [`deploy/.env.example`](deploy/.env.example); the Go server ignores `DOCKERHUB_NAMESPACE` if present).

```bash
cp deploy/.env.example .env   # fill in with secrets at the repository root
cd backend
go run ./cmd/server
```

By default the API listens on `http://localhost:8080`. Before finishing backend changes, run `./shipcheck.sh` from `backend/`.

## Further reading

- [Deployment (local vs dev droplet)](docs/deploy.md)
- [Repository conventions](docs/conventions.md)
- [OpenAPI specs](docs/openapi/)
- [Database schema reference](docs/db/schema.sql)
