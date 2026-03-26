# Frontend Agent Guide

Read `/AGENTS.md` first, then use this file for frontend work.

## Development rules

- Scope frontend changes to the smallest surface that satisfies the request.
- Consult `backend/` only when you need to verify an API contract, response shape, validation rule, or authentication flow.
- Preserve established UI patterns unless the task explicitly asks for a redesign.
- Keep components readable, composable, and easy to maintain.
- Use clear names for components, hooks, state, and service modules.
- For enums and union-of-string literals that represent fixed sets (status, type, role), use **UPPERCASE** values (for example `type Status = 'ACTIVE' | 'INACTIVE'`).
- When backend contracts are unclear or outdated, update the relevant OpenAPI spec or ask for clarification instead of hard-coding assumptions.

## Documentation and testing

- When frontend behavior depends on undocumented backend behavior, flag it and align the contract documentation.
- Add or update tests for behavior that materially changes user interaction, rendering, or data flow.
