# CMPE354 Group 11 Repository - Social Event Mapper

## Backend

Run the API server:

```bash
cd backend
cp .env.example .env   # optional: override secrets for local dev
go run ./cmd/server
```

### Docker (API + PostGIS)

Requires [Docker Compose](https://docs.docker.com/compose/). From the repository root:

```bash
docker compose up --build
```

- **API:** `http://localhost:8080` — `GET /health` should return `200` (port: `APP_PORT`, default `8080`).
- **Database:** Postgres stays on the Docker network only (not on the host). To reach it from your machine at `localhost:5432` (GUI, `psql`, local `go run`), copy [`docker-compose.override.example.yml`](docker-compose.override.example.yml) to `docker-compose.override.yml`.
- **Env overrides:** Optionally copy [`.env.example`](.env.example) to `.env` at the repo root for DB credentials, `JWT_SECRET`, etc. (gitignored).

PostGIS runs with a persistent volume; migrations apply on API startup. Full options: [`backend/.env.example`](backend/.env.example).

## Database

- Canonical PostgreSQL DDL (PostGIS, tables, indexes, triggers): [`docs/db/schema.sql`](docs/db/schema.sql)
- Versioned migrations ([golang-migrate](https://github.com/golang-migrate/migrate) format): `backend/migrations/`
