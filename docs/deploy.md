# Deployment (dev droplet, Docker Hub)

This document matches the **remote dev** stack: pre-built images on Docker Hub (`:latest`), [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml), and **secrets in GitHub** — not a hand-maintained `.env` on the server long term.

## Compose files in the repo

| File | Purpose |
|------|---------|
| [`deploy/docker-compose.local.yml`](../deploy/docker-compose.local.yml) | **Local:** `build:` from `../backend` and `../frontend`. Postgres is published to **127.0.0.1:5433** on the host (→ container `5432`) for development (psql, GUI clients). |
| [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml) | **Dev droplet:** `image:` from Docker Hub `latest`; no source build on the server. Postgres is **not** exposed on a host port (Docker network only). |

For local development, run from the **repository root** and set the Compose project directory to the repo root so the root `.env` is loaded: `docker compose --project-directory . -f deploy/docker-compose.local.yml up --build` (Compose’s default project dir is the compose file’s folder, `deploy/`, which does not contain `.env`). For the dev server, use the same layout on the droplet (`deploy/`, `nginx/`, `.env` at the environment root) and run `docker compose -f deploy/docker-compose.dev.yml ...` from that root — paths in the compose file are relative to `deploy/`, so `../nginx/nginx.dev.conf` resolves correctly.

### Local Postgres port (development only)

When you use [`deploy/docker-compose.local.yml`](../deploy/docker-compose.local.yml), PostGIS is reachable on **127.0.0.1:5433** on your machine (host port only; the container still uses `5432` internally). Connect with user `postgres`, database `sem`, and the password from the root `.env`. This is intentional for testing and ad-hoc queries; it does not apply to [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml), where the database stays internal to the Compose network.

## Nginx: local vs server

| File | Used by | Purpose |
|------|---------|---------|
| [`nginx/nginx.local.conf`](../nginx/nginx.local.conf) | [`deploy/docker-compose.local.yml`](../deploy/docker-compose.local.yml) | HTTP only (port 80), for **local** Docker. Keep this minimal so `docker compose … up` works without TLS. |
| [`nginx/nginx.dev.conf`](../nginx/nginx.dev.conf) | [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml) | HTTPS (443), HTTP→HTTPS redirect; same `/api/` and `/` proxy rules. Mount expects TLS files under **`certs/`** at the repo root (see below). |

Track **both** files in git: local and droplet stay reproducible; secrets stay off-repo.

## API documentation

This section covers **OpenAPI 3.x YAML** specs and the **Swagger UI** used to browse them interactively. This keeps the Go API binary free of documentation routes: **nginx** serves the documentation files only in the **local Docker Compose** stack.

### How it works

1. **Local Compose** bind-mounts **only** [`docs/openapi/`](../docs/openapi/) and [`docs/swagger-ui/`](../docs/swagger-ui/) into the nginx container (read-only). Other repo folders under `docs/` (for example `db/`, `design/`) are **not** mounted, so they cannot be served or enumerated by nginx. [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml) does **not** mount these folders.
2. **Nginx** exposes:
   - **`/api/docs/`** — Swagger UI (HTML + vendored Swagger UI JS/CSS under [`docs/swagger-ui/`](../docs/swagger-ui/)).
   - **`/api/docs/openapi/`** — Raw OpenAPI files (e.g. [`docs/openapi/auth.yaml`](../docs/openapi/auth.yaml)).
3. **Backend traffic** is unchanged: in local, requests under **`/api/`** that are *not* matched by the docs locations still proxy to the Go service. In the dev droplet, there are no nginx docs routes, so all **`/api/`** traffic goes straight to the backend proxy.

Swagger UI assets are **vendored** in git (see [`docs/swagger-ui/vendor/README.md`](../docs/swagger-ui/vendor/README.md)) so the docs work **without internet access** (no CDN).

### URLs

| Environment | Swagger UI | Example spec URL |
|-------------|------------|------------------|
| **Local** (`docker-compose.local`) | `http://localhost/api/docs/` | `http://localhost/api/docs/openapi/auth.yaml` |
| **Dev droplet** (HTTPS) | Not served | Not served |

`/api/docs` without a trailing slash redirects to `/api/docs/`.

### Multiple OpenAPI specs

The UI loads a small manifest: [`docs/openapi/specs.json`](../docs/openapi/specs.json). Each entry has a stable `name`, a `displayName` for the dropdown, and a `url` relative to the UI (typically `./openapi/<file>.yaml`).

To add another API:

1. Add `docs/openapi/<your-spec>.yaml`.
2. Append an object to `specs.json` with a unique `name` and the correct `url`.
3. Open the UI with `?spec=<name>` to select that spec by default, or use the built-in spec picker.

OpenAPI `servers` in each YAML should match how clients call the API (this repo uses `url: /api` for same-origin requests from the browser).

On the droplet, create a `certs/` directory next to `deploy/` and `nginx/` with your real certificate files (e.g. `fullchain.pem`, `privkey.pem` — names must match [`nginx/nginx.dev.conf`](../nginx/nginx.dev.conf) or edit that file to match your paths). **Never commit** keys or certs.

## Suggested layout on the droplet

Mirror the repo (compose under `deploy/`, nginx at repo root). Example: `/opt/sem/`:

```
/opt/sem/
├── deploy/
│   ├── docker-compose.local.yml  # optional on server; dev uses docker-compose.dev.yml
│   └── docker-compose.dev.yml
├── nginx/
│   ├── nginx.local.conf          # local stack; compose.dev mounts nginx.dev.conf
│   └── nginx.dev.conf           # TLS config used on the droplet
├── certs/                        # on server only: fullchain.pem, privkey.pem (not in git)
├── .env                          # generated by CI from GitHub Secrets (not committed)
└── scripts/                      # optional: deploy.sh
```

Do not rely on editing `.env` by hand in production; the deploy pipeline should **write `.env` from GitHub** each time so credentials stay in one place.

## Environment variables (app contract)

The root [`.env.example`](../.env.example) is now secret-only. Non-secret values such as Postgres user/database live directly in the compose files, and backend runtime defaults live in `backend/config/application.*.yaml`.

These names still matter at runtime:

| Variable | Used by |
|----------|---------|
| `DB_PASSWORD` | Postgres + backend |
| `JWT_SECRET` | Backend |
| `DOCKERHUB_NAMESPACE` | `deploy/docker-compose.dev.yml` image names only; provide via shell or CI |

`DOCKERHUB_NAMESPACE` is your Docker Hub user or organization; images are expected as:

- `${DOCKERHUB_NAMESPACE}/sem-backend-dev:latest`
- `${DOCKERHUB_NAMESPACE}/sem-frontend-dev:latest`

## GitHub Secrets → server `.env`

Store values in **GitHub Actions secrets** (or **Environment** secrets for `dev`, later `prod`). The deploy job should SSH to the droplet and **create or overwrite** `/opt/sem/.env` before `docker compose pull`.

Example mapping (name secrets however you prefer; align with your workflow):

| GitHub secret (example) | Line in `.env` |
|-------------------------|----------------|
| `DB_PASSWORD` | `DB_PASSWORD=...` |
| `JWT_SECRET` | `JWT_SECRET=...` |

In **GitHub Actions**, pass secrets into a remote step (e.g. `appleboy/ssh-action` with `script`, or inline `ssh` with env vars exported from `${{ secrets.* }}`). On the **server**, the resulting file is plain key=value lines, for example:

```bash
# Resulting /opt/sem/.env (values come from GitHub Secrets at deploy time — not committed)
DB_PASSWORD=...
JWT_SECRET=...
```

Provide `DOCKERHUB_NAMESPACE` separately in the deploy shell or CI environment, for example `export DOCKERHUB_NAMESPACE=your-dockerhub-user` before running `docker compose`. Use `printf`, `envsubst` on a small `.env.template` in the repo, or your action’s `script` to write the secret-only `.env` file; escape values that contain `$` or newlines. **Never commit** real `.env` files.

### Docker Hub pull on the droplet

If images are private, log in once or per deploy:

```bash
echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
```

Store `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (or access token) as GitHub secrets; use least privilege (read-only for pull).

### Typical dev deploy commands (after `.env` exists)

From `/opt/sem/` (or your chosen root that mirrors `deploy/` + `nginx/`):

```bash
docker compose -f deploy/docker-compose.dev.yml pull
docker compose -f deploy/docker-compose.dev.yml up -d
```

## CI/CD (out of scope for initial repo setup)

When you add workflows:

- **`dev` branch:** build and push `sem-backend-dev:latest` and `sem-frontend-dev:latest` to Docker Hub; then SSH to the dev droplet, write `.env` from **Environment `dev`** secrets, `docker login` if needed, `compose pull` + `up -d`.
- **`main` / prod:** same pattern later against a **prod** droplet and **Environment `prod`** secrets.

Image tag strategy for this repo: **`latest`** for both stacks unless you introduce semver later.

## Future: production compose

When the production droplet exists, add a **third** compose file under `deploy/` (e.g. `deploy/docker-compose.prod.yml`) alongside the same nginx/Postgres patterns, pointing at the same or separate Docker Hub repositories, and wire a workflow that runs on **`main`** merges to deploy to prod. Until then, only [`deploy/docker-compose.local.yml`](../deploy/docker-compose.local.yml) (local) and [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml) (dev server) are defined in this repository.
