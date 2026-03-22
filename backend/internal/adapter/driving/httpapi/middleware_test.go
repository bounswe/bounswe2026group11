package httpapi

import (
	"fmt"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// fakeVerifier implements domain.TokenVerifier for testing.
type fakeVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
}

// testApp builds a minimal Fiber app with RequireAuth and a dummy protected route.
func testApp(verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	app.Get("/protected", RequireAuth(verifier), func(c *fiber.Ctx) error {
		claims := UserClaims(c)
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"user_id": claims.UserID.String(),
		})
	})
	return app
}

func TestRequireAuthMissingHeader(t *testing.T) {
	app := testApp(&fakeVerifier{})

	req := httptest.NewRequest(fiber.MethodGet, "/protected", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestRequireAuthMalformedHeader(t *testing.T) {
	app := testApp(&fakeVerifier{})

	req := httptest.NewRequest(fiber.MethodGet, "/protected", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Token abc123")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestRequireAuthInvalidToken(t *testing.T) {
	app := testApp(&fakeVerifier{err: fmt.Errorf("token expired")})

	req := httptest.NewRequest(fiber.MethodGet, "/protected", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer expired.token.here")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestRequireAuthValidToken(t *testing.T) {
	userID := uuid.New()
	app := testApp(&fakeVerifier{
		claims: &domain.AuthClaims{
			UserID:   userID,
			Username: "akif",
			Email:    "akif@example.com",
		},
	})

	req := httptest.NewRequest(fiber.MethodGet, "/protected", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token.here")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d — body: %s", resp.StatusCode, body)
	}
}

func TestRequestLoggerPassesThrough(t *testing.T) {
	app := fiber.New()
	app.Use(RequestLogger())
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest(fiber.MethodGet, "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
