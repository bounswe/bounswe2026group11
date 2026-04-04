package httpapi

import (
	"log/slog"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// contextKeyUserClaims is the key used to store AuthClaims in the Fiber context.
const contextKeyUserClaims = "user_claims"

// RequireAuth returns a middleware that validates the Bearer access token in the
// Authorization header. On success it stores the claims in the request context
// so downstream handlers can call UserClaims(c). On failure it returns 401.
func RequireAuth(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := extractBearer(header)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(ErrorEnvelope{
				Error: ErrorBody{
					Code:    "missing_token",
					Message: "Authorization header with Bearer token is required.",
				},
			})
		}

		claims, err := verifier.VerifyAccessToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(ErrorEnvelope{
				Error: ErrorBody{
					Code:    "invalid_token",
					Message: "The access token is invalid or expired.",
				},
			})
		}

		c.Locals(contextKeyUserClaims, claims)
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
			return c.Status(fiber.StatusUnauthorized).JSON(ErrorEnvelope{
				Error: ErrorBody{
					Code:    "invalid_token",
					Message: "The access token is invalid or expired.",
				},
			})
		}

		c.Locals(contextKeyUserClaims, claims)
		return c.Next()
	}
}

// UserClaims retrieves the authenticated user's claims from the request context.
// Returns nil if RequireAuth middleware was not applied to the route.
func UserClaims(c *fiber.Ctx) *domain.AuthClaims {
	claims, _ := c.Locals(contextKeyUserClaims).(*domain.AuthClaims)
	return claims
}

// RequestLogger returns a middleware that logs the HTTP method, path, status
// code, and latency of every request using the structured logger.
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		slog.Info("request",
			"method", c.Method(),
			"path", c.Path(),
			"status", c.Response().StatusCode(),
			"latency", time.Since(start).String(),
		)
		return err
	}
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
