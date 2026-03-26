# Repository Agent Guide

This repository keeps agent instructions in versioned Markdown files so every AI coding agent can read the same guidance.

## How to use this guide

1. Read this file first.
2. Before making changes, read the `AGENTS.md` file that is closest to the area you will edit.
3. Use cross-surface context only when it is required to understand an existing contract, shared behavior, or API consumer expectation.

## Repository structure

- `backend/AGENTS.md`: backend development and testing rules
- `frontend/AGENTS.md`: frontend-specific expectations
- `mobile/AGENTS.md`: mobile-specific expectations

## Global rules

- **Enums**: Use uppercase letters for enum member names and their serialized values (for example `ACTIVE`, `PENDING`) across APIs, domain models, and clients unless an existing area already follows a different, documented convention.
- Keep changes scoped to the requested surface unless the task explicitly requires a shared change.
- Prefer small, reviewable changes that fit the current architecture of the touched area.
- Do not silently introduce architectural drift. If a requested change would deepen an already weak structure, stop and propose a cleanup plan first.
- When backend contracts change, update the documentation under `docs/openapi/` so frontend and mobile teams can implement without ambiguity.
- Follow repository conventions documented in `docs/conventions.md`.
