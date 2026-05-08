package httpapi

import (
	"context"
	"sync/atomic"

	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// LocalePreferenceLookup resolves the persisted locale preference for the
// authenticated user. Implementations should return ("", false) on miss
// (user not found, no preference, or DB error) so the middleware falls
// back to the default. Errors are intentionally swallowed at this seam:
// locale resolution must never fail a request.
type LocalePreferenceLookup func(ctx context.Context, userID uuid.UUID) (i18n.Locale, bool)

// localePrefLookupRef holds the optional user-preference lookup. It is set
// once at server startup via SetLocalePreferenceLookup and consulted by the
// auth middlewares after they attach claims, so that authenticated requests
// without an explicit Accept-Language header can still be localized to the
// user's stored preference.
var localePrefLookupRef atomic.Pointer[LocalePreferenceLookup]

// SetLocalePreferenceLookup registers (or clears with nil) the function used
// by RequireAuth/RequireAdmin/OptionalAuth to fall back to the user's saved
// locale preference when the request has no Accept-Language header.
func SetLocalePreferenceLookup(lookup LocalePreferenceLookup) {
	if lookup == nil {
		localePrefLookupRef.Store(nil)
		return
	}
	localePrefLookupRef.Store(&lookup)
}

func localePrefLookup() LocalePreferenceLookup {
	if p := localePrefLookupRef.Load(); p != nil {
		return *p
	}
	return nil
}

// ResolveLocale returns a Fiber middleware that resolves the request locale
// from the Accept-Language header. It runs globally so unauthenticated
// routes (e.g. /auth/*) also produce localized error envelopes. The user-
// preference fallback for authenticated requests is applied separately by
// the auth middlewares via SetLocalePreferenceLookup.
func ResolveLocale() fiber.Handler {
	return func(c *fiber.Ctx) error {
		loc := i18n.DefaultLocale
		if header := c.Get(fiber.HeaderAcceptLanguage); header != "" {
			if resolved, ok := i18n.ResolveFromAcceptLanguage(header); ok {
				loc = resolved
			}
		}
		attachLocale(c, loc)
		return c.Next()
	}
}

// applyLocalePreference is called by auth middlewares after claims are set.
// It overrides the request locale with the user's saved preference only when
// the request did not carry a parseable Accept-Language header (so an
// explicit per-request choice always wins).
func applyLocalePreference(c *fiber.Ctx, userID uuid.UUID) {
	if header := c.Get(fiber.HeaderAcceptLanguage); header != "" {
		if _, ok := i18n.ResolveFromAcceptLanguage(header); ok {
			return
		}
	}
	lookup := localePrefLookup()
	if lookup == nil {
		return
	}
	if loc, ok := lookup(c.UserContext(), userID); ok && loc != "" {
		attachLocale(c, loc)
	}
}

func attachLocale(c *fiber.Ctx, loc i18n.Locale) {
	c.Locals(contextKeyLocale, loc)
	c.SetUserContext(i18n.WithLocale(c.UserContext(), loc))
}

// contextKeyLocale is the Fiber-locals key used by middleware that wants
// to read the resolved locale without going through the request context.
const contextKeyLocale = "locale"

// LocaleFromCtx returns the locale resolved by ResolveLocale, or
// i18n.DefaultLocale when the middleware was not mounted on this route.
func LocaleFromCtx(c *fiber.Ctx) i18n.Locale {
	if v, ok := c.Locals(contextKeyLocale).(i18n.Locale); ok && v != "" {
		return v
	}
	return i18n.DefaultLocale
}
