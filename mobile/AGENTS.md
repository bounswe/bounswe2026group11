# Mobile Agent Guide

Read `/AGENTS.md` first, then use this file for mobile work.

## Development rules

- Scope mobile changes to the requested flow and avoid unrelated UI or navigation churn.
- Consult `backend/` only when you need to verify an API contract, payload shape, validation rule, or auth behavior.
- Reuse shared mobile patterns before introducing new architectural conventions.
- Keep screens, hooks, and service layers understandable and maintainable.
- Use explicit names and keep platform-specific behavior visible where it matters.
- When an API contract is ambiguous, align with the OpenAPI documentation or update it as part of the backend contract change.

## Documentation and testing

- Add or update tests for changed mobile behavior where the project already has coverage patterns for that area.
- Flag backend contract gaps early so mobile implementation does not depend on guesswork.
