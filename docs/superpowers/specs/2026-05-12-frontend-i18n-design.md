# Frontend i18n (TR/EN) — Design

**Issue:** [#508](https://github.com/bounswe/bounswe2026group11/issues/508)
**Date:** 2026-05-12
**Template:** Mobile PR [#612](https://github.com/bounswe/bounswe2026group11/pull/612)

## Goal

Add Turkish/English localization to the Vite + React 19 web app, mirroring the
architecture and breadth of the merged mobile PR #612.

## Stack

- `i18next` + `react-i18next` — same engine as mobile.
- Persistence: `localStorage` (web) — replaces mobile's `expo-secure-store`.
- Initial detection: `navigator.language` — replaces mobile's `expo-localization`.
- No backend changes required: locale persistence on `PATCH /me` was shipped by
  backend PR #580.

## Architecture

### New modules

- `frontend/src/i18n/index.ts`
  - Exports `SUPPORTED_LOCALES = ['en','tr'] as const`, `Locale` type,
    `isSupportedLocale`, `resolveLocale(navigatorTag)`, and the configured
    `i18next` instance.
  - `react: { useSuspense: false }` so first paint never blocks on i18n.
- `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/tr.json`
  - Translation catalogs, organized by feature namespace
    (`auth.*`, `discover.*`, `events.*`, `profile.*`, `tickets.*`,
    `favorites.*`, `invitations.*`, `notifications.*`, `common.*`,
    `categories.*`, `statuses.*`).
- `frontend/src/contexts/LocaleContext.tsx`
  - `LocaleProvider` — loads persisted locale on mount (localStorage →
    `navigator.language` fallback → `en`), calls `i18n.changeLanguage`,
    exposes `{ locale, isHydrating, setLocale }`.
  - `useLocale()` hook.
  - `getCurrentLocale()` module-level singleton mirror so non-React callers
    (the API layer) can read the active locale without a provider.

### Wiring

- `frontend/src/main.tsx` — wraps the tree with `<LocaleProvider>`, placed
  outermost among the existing providers so `useTranslation` is available
  inside `AuthProvider`/`ThemeProvider`.
- `frontend/src/services/api.ts` — adds `Accept-Language: <locale>` header on
  every request, sourced from `getCurrentLocale()`.
- Language switcher lives in `ProfilePage` (matches mobile placement).
- On locale change: `setLocale` updates singleton + i18n + localStorage, and —
  when the user is authenticated — also fires `PATCH /me { locale }` so the
  backend persists the preference (best-effort; failure does not roll back the
  local change).

### Locale-aware helpers

Pulled through `i18n.t(...)` instead of inline literals:

- Event category labels
- Event status labels
- Ticket status labels
- Event date / relative-time formatting

Pattern matches mobile's `utils/eventCategoryPresentation.ts` etc.

## Screen coverage

Target list (mirrors mobile's breadth — equivalent web routes):

**Auth**
- `LoginView`, `RegisterView`, `ForgotPasswordView`, `LandingPage`, `AuthPage`

**Discover**
- `DiscoverPage`, `DiscoverEventSidePanel`, `DiscoverMapView`

**Events**
- `CreateEventPage`, `EditEventPage`, `EventDetailPage`,
  `EventInteractionPanel`, `EventDetailMiniMap`, `MyEventsPage`

**Profile**
- `ProfilePage` (with language switcher), `PublicProfilePage`,
  `ProfilePublicSections`

**Tickets**
- `TicketsPage`, `TicketDetailPage`

**Favorites / Invitations / Notifications**
- `FavoritesPage`, `FavoriteLocationsTab`, `InvitationsPage`,
  `NotificationsPage`

**Shared chrome**
- Nav header, common buttons, form labels, error toasts —
  whatever the above screens touch.

## Out of scope

- Backoffice admin views (`views/backoffice/*`) — not in mobile either, lower
  priority, follow-up issue.
- `views/fallback/*` — minimal text, can ship in a follow-up.
- New language additions beyond TR/EN.

## Testing strategy

- **Catalog parity test** (`src/i18n/locales.test.ts`):
  - Both JSON files parse.
  - EN keys === TR keys (recursive deep-key set comparison).
  - No empty string values.
- **LocaleContext test** (`src/contexts/LocaleContext.test.tsx`):
  - Defaults to `en` when storage empty and `navigator.language` unsupported.
  - Picks `tr` from `navigator.language` starting with `tr`.
  - `setLocale` updates `i18n.language`, persists to localStorage, and (when
    authenticated) calls `profileService.updateMe`.
- **Existing Vitest suites** must still pass. Test setup (`src/test/setup.ts`
  or per-file) imports `@/i18n` so `useTranslation` works in tests; for tests
  that assert literal English strings, we pre-set `i18n.changeLanguage('en')`.
- **API header test** — extend `api.test.ts` to assert the
  `Accept-Language` header equals the current locale.

## Acceptance criteria mapping (from #508)

- [x] Web app supports TR and EN → catalogs + provider
- [x] Targeted screens have externalized strings → coverage list above
- [x] Language switching works without navigation breakage →
      `i18n.changeLanguage` is reactive via `react-i18next`; no remount
- [x] Selected language persists across refresh → localStorage
- [x] `Accept-Language` header sent on API calls → `api.ts` change
- [x] Key screens QA'd in both languages → manual QA pass before PR

## Risks / open questions

- **Test churn:** Existing component tests asserting literal English strings
  will break. Mitigation: pre-set `i18n.changeLanguage('en')` in test setup
  and keep English copy identical where possible.
- **Bundle size:** `i18next` + `react-i18next` ≈ 40 KB gz. Acceptable.
- **Long Turkish strings:** Layout regressions on tight buttons / chips.
  Mitigation: manual QA pass; flag any that need CSS tweaks.

## Implementation order

1. Branch off `main`: `feat/frontend-i18n` (or `feature/508-frontend-i18n`).
2. Infrastructure: `i18n/index.ts`, catalogs scaffold, `LocaleContext`,
   `main.tsx` wiring, `api.ts` header, parity test. Land green.
3. Translate auth screens + language switcher in profile. Land green.
4. Translate discover + events. Land green.
5. Translate profile + tickets + favorites + invitations + notifications.
6. Shared chrome + locale-aware helpers (categories/statuses/dates).
7. Manual QA pass in both languages; fix layout regressions.

Each step ends with `npm test` and `npm run build` green.
