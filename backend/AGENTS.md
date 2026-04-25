# Backend Agent Guide

Read `/AGENTS.md` first, then use this file for backend work.

## Development rules

- Before implementation, identify which backend layers, modules, and contracts will be affected. Make a short plan based on that impact analysis.
- Check `frontend/` or `mobile/` only when you need to understand an existing user flow, API consumption pattern, or contract expectation. Do not spend context on those surfaces unless it is necessary.
- Prefer changes that preserve or improve the current clean architecture and hexagonal architecture boundaries.
- Write code that is aligned with SOLID, DRY, scalability, and long-term maintainability.
- Use explicit, meaningful names for variables, methods, services, and types. Keep naming consistent with the existing backend structure and domain language.
- For enumerated values (constants, domain status/type strings, API and OpenAPI enum values), use **UPPERCASE** identifiers and wire/string values (for example `PUBLISHED`, `DRAFT`).
- **Enum-like closed sets**: Do not scatter raw `string` values for the same concept across handlers, repos, and SQL. In `internal/domain`, add a dedicated named type (`type FooStatus string`), one **const** per allowed value using the **UPPERCASE** wire string, and short comments where the set is not obvious. As the set grows, extend the same type with shared helpers (parse/validate from untrusted input, list valid values, `String()`), so new cases live in one place and call sites stay type-safe.
- **Where those types live**: Parse and map wire strings to domain types at adapter boundaries (HTTP, persistence). Application services should take and return domain enum-like types, not ad hoc strings. When you add or change a set, update the relevant OpenAPI spec under `docs/openapi/` like any other API contract change.
- Keep business rules inside the correct application or domain layer instead of leaking them into transport, bootstrap, or infrastructure code.
- Prefer focused abstractions and composable services over large multipurpose handlers or services.

## Comments and readability

- Follow the existing backend style of placing explanatory comments above important methods, exported functions, and non-obvious domain logic.
- Add inline comments inside methods when the flow is trivial-to-misread, constraint-heavy, or otherwise hard to infer from the code alone.
- Do not add comments that only restate the code. Comments should explain intent, invariants, edge cases, or why a decision exists.

## Observability and logging

- Prefer **structured application logs** at meaningful business boundaries instead of logging every incoming HTTP request.
- Keep backend request-level telemetry in **OpenTelemetry metrics/traces**; do not reintroduce generic per-request info logs when route/span metrics already cover that need.
- When adding logs in HTTP handlers or application-entry boundaries, use the shared structured logging helpers under `internal/adapter/out/httpapi/` so field names stay consistent across the backend.
- Include safe, low-noise context that helps debugging and correlation:
  - operation name (for example `event.discover`, `profile.update`)
  - stable IDs such as `user_id`, `event_id`, `join_request_id`, `favorite_location_id` when relevant
  - low-cardinality result fields such as `result_count`, `has_next`, booleans, or status-like fields
- For request/query/filter context, prefer a **single summary string field** (for example `query_summary`) over exploding many dynamic attributes; this keeps cardinality under control in New Relic.
- Do **not** log secrets or confidential payloads. Never log tokens, passwords, OTP/reset/confirm tokens, raw authorization headers, or sensitive free-form user content unless there is an explicit, reviewed reason and the value is redacted.
- Be especially careful with user-editable text fields. Prefer logging presence/absence, counts, or updated field names instead of raw values unless the field is clearly non-sensitive and operationally necessary.
- When OTLP/New Relic is configured, backend logs are expected to go through the OpenTelemetry pipeline instead of stdout. Do not add alternate console logging paths that duplicate those records.
- If you add a new high-value endpoint or mutation, consider whether it also needs a structured success log for observability. Keep the wording short, action-oriented, and consistent with existing messages.
- If you change observability bootstrap behavior, preserve both of these contracts unless the task explicitly changes them:
  - HTTP metrics/traces continue to flow through the OpenTelemetry middleware
  - application logs continue to expose `level`/severity information in New Relic

## API documentation

- After completing backend development, add or update the relevant OpenAPI documentation under `/docs/openapi/`.
- Document the endpoint so frontend and mobile developers can implement against it without open questions.
- Include request and response shapes, validation rules, authentication requirements, important error cases, and behavior notes that affect client implementation.
- If a contract change affects an existing spec, update the current file instead of leaving stale documentation behind.

## Testing rules

- Add new unit tests or update existing ones for every backend behavior change.
- Structure tests with explicit `given`, `when`, and `then` sections, matching the style already used in the backend test suite.
- Keep tests deterministic and safe for parallel execution whenever flakiness can be avoided.
- When writing or updating integration tests, make sure they continue to use the shared test container setup instead of creating isolated ad hoc infrastructure.
- Test behavior and contracts, not just implementation details.
- Cover success paths, validation failures, and the most relevant edge cases introduced by the change.

## Ship check (before marking work complete)

- Before you tell the user that backend work is finished, run `./shipcheck.sh` from the `backend/` directory. It runs the full local gate (modules, format, vet, static analysis, vulnerability scan, build, unit tests, and integration tests; see the script header for details).
- If `./shipcheck.sh` fails, fix the reported issues and re-run until it passes. Do not treat the task as complete while the script is red.
