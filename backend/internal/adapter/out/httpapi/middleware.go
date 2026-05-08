package httpapi

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// contextKeyUserClaims is the key used to store AuthClaims in the Fiber context.
const contextKeyUserClaims = "user_claims"

// Catalog keys used by auth middleware error responses.
const (
	msgKeyMissingToken        = "error.missing_token"
	msgKeyInvalidToken        = "error.invalid_token"
	msgKeyAdminAccessRequired = "error.admin_access_required"
)

func missingTokenError() *domain.AppError {
	return domain.AuthErrorI18n("missing_token", msgKeyMissingToken)
}

func invalidTokenError() *domain.AppError {
	return domain.AuthErrorI18n("invalid_token", msgKeyInvalidToken)
}

func adminAccessRequiredError() *domain.AppError {
	return domain.ForbiddenErrorI18n(domain.ErrorCodeAdminAccessRequired, msgKeyAdminAccessRequired)
}

// RequireAuth returns a middleware that validates the Bearer access token in the
// Authorization header. On success it stores the claims in the request context
// so downstream handlers can call UserClaims(c). On failure it returns 401.
func RequireAuth(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := extractBearer(header)
		if !ok {
			return WriteError(c, missingTokenError())
		}

		claims, err := verifier.VerifyAccessToken(token)
		if err != nil {
			return WriteError(c, invalidTokenError())
		}

		c.Locals(contextKeyUserClaims, claims)
		applyLocalePreference(c, claims.UserID)
		return c.Next()
	}
}

// RequireAdmin returns middleware that first authenticates the request and then
// requires the caller's role claim to be ADMIN. Authentication failures keep the
// standard 401 behavior from RequireAuth; authenticated non-admins receive 403.
func RequireAdmin(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := extractBearer(header)
		if !ok {
			return WriteError(c, missingTokenError())
		}

		claims, err := verifier.VerifyAccessToken(token)
		if err != nil {
			return WriteError(c, invalidTokenError())
		}
		if claims.Role != domain.UserRoleAdmin {
			return WriteError(c, adminAccessRequiredError())
		}

		c.Locals(contextKeyUserClaims, claims)
		applyLocalePreference(c, claims.UserID)
		return c.Next()
	}
}

// OptionalAuth returns a middleware that parses the Bearer token if present
// and stores the claims in the request context. If the header is absent the
// request proceeds unauthenticated (UserClaims will return nil). If a token
// is present but invalid the request is rejected with 401.
func OptionalAuth(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := extractBearer(header)
		if !ok {
			return c.Next()
		}

		claims, err := verifier.VerifyAccessToken(token)
		if err != nil {
			return WriteError(c, invalidTokenError())
		}

		c.Locals(contextKeyUserClaims, claims)
		applyLocalePreference(c, claims.UserID)
		return c.Next()
	}
}

// UserClaims retrieves the authenticated user's claims from the request context.
// Returns nil if RequireAuth middleware was not applied to the route.
func UserClaims(c *fiber.Ctx) *domain.AuthClaims {
	claims, _ := c.Locals(contextKeyUserClaims).(*domain.AuthClaims)
	return claims
}

// RequireAdminRole is intended to be mounted after RequireAuth when route
// groups need to compose authentication separately from authorization.
func RequireAdminRole(c *fiber.Ctx) error {
	claims := UserClaims(c)
	if claims == nil {
		return WriteError(c, missingTokenError())
	}
	if claims.Role != domain.UserRoleAdmin {
		return WriteError(c, adminAccessRequiredError())
	}
	return c.Next()
}

// extractBearer parses "Bearer <token>" from an Authorization header value.
func extractBearer(header string) (string, bool) {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}
