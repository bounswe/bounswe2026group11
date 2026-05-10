# Frontend Agent Guide

Read `/AGENTS.md` first, then use this file for frontend work.

## Stack

- **UI:** React.
- **Map:** Google Maps via [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/) (Vector maps, AdvancedMarker, light/dark `colorScheme`).
  - The API key is read from `VITE_GOOGLE_MAPS_WEB_API_KEY` (and an optional Map ID from `VITE_GOOGLE_MAPS_MAP_ID`). See `.env.example`. When the key is missing, map components render a graceful fallback so the rest of the UI still works in dev.
  - The provider is mounted once near the route tree in `src/components/GoogleMapsProvider.tsx`; do not instantiate `<APIProvider>` again in feature code.
  - Discover view-mode (list vs. map) is shared between the global header toggle and the Discover page through `src/contexts/DiscoverViewModeContext.tsx`.

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

## Architectural Patterns: Auth Flows

- **Multi-Step Auth Flows**: Features like `Register` and `ForgotPassword` inherently rely on a multi-step design (e.g., request -> verify OTP -> finalize). These flows must be implemented using a single `ViewModel` (e.g., `useForgotPasswordViewModel`) that manages the internal `step` state, validation logic per step, and consecutive API calls, alongside a corresponding monolithic view (e.g., `ForgotPasswordView`) rendering the conditional UI based on the `step`. Avoid breaking these steps into distinct Route URLs unless required by business logic.
