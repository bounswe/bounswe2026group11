# Git and PR conventions

## Commit messages (Conventional Commits)

**Format:** `type(optional scope): description`

| type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `test` | Tests added or updated |
| `refactor` | Code structure change, same behavior |
| `chore` | Maintenance, tooling, small config |
| `devops` | CI, build/packaging, performance tuning, deployment and infra-related changes |

**Examples:** `feat: add location search`, `fix(api): parsing error on empty body`

---

## Branch names

**Format:** `<prefix>/<issue-number>-<short-description>` (kebab-case after the number)

Start every branch with the **GitHub issue number** (or equivalent tracker id), then a short slug.

| prefix | Purpose |
|--------|---------|
| `feature/` | New feature work |
| `fix/` | Bug fixes |
| `devops/` | CI, deployment, infrastructure, IaC |
| `chore/` | Maintenance, deps, tooling (no product feature) |
| `docs/` | Documentation only |

**Examples:** `feature/115-add-api`, `fix/42-empty-response`, `devops/8-terraform-db`, `docs/3-readme-setup`

---

## Pull request scope

Each PR should change **one product surface** at a time—for example the **backend** (API, services, server config) or the **mobile** app—not both in the same merge.

When a feature needs server and client work, split it into **separate PRs** (and usually separate issues/branches), and link them in the descriptions. That keeps reviews focused, CI runs meaningful for each stack, and rollbacks or cherry-picks stay safe.

Shared-only exceptions (e.g. a root `README` or repo-wide policy) should stay small and clearly unrelated to app logic.

---

## Before opening a PR

1. **Target `dev`:** Open every PR against `dev`, not `main`.
2. Code runs successfully locally.
3. Commits and style match this doc.
4. **Branch is up to date with `dev`** — sync before the PR (`git pull` or `git rebase` onto `dev`).

## Deployment (shared dev server)

Merges to **`main`** trigger CD that deploys to the **development droplet** (the remote stack described in [`docs/deploy.md`](./deploy.md)). That is independent of the **`dev` branch**, which is for integration PRs. Do not assume that pushing to `dev` updates the server; the path to the live dev environment is **`main`**.

## Merge

- Merge only after at least **one** approved review.
- The team reviews each other’s work as part of normal development.
