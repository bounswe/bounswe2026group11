package server

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/config"
	"github.com/gofiber/fiber/v2"
)

func securityTestApp(cfg *config.Config) *fiber.App {
	app := fiber.New(fiber.Config{BodyLimit: maxRequestBodyBytes(cfg)})
	installGlobalSecurityMiddleware(app, cfg)
	app.Get("/ok", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	app.Post("/echo", func(c *fiber.Ctx) error {
		return c.Send(c.Body())
	})
	app.Get("/panic", func(_ *fiber.Ctx) error {
		panic("boom")
	})
	return app
}

func TestGlobalSecurityMiddlewareSetsHeaders(t *testing.T) {
	// given
	app := securityTestApp(nil)
	req := httptest.NewRequest(fiber.MethodGet, "/ok", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	assertHeader(t, resp.Header.Get(fiber.HeaderXContentTypeOptions), "nosniff", fiber.HeaderXContentTypeOptions)
	assertHeader(t, resp.Header.Get(fiber.HeaderXFrameOptions), "DENY", fiber.HeaderXFrameOptions)
	assertHeader(t, resp.Header.Get(fiber.HeaderReferrerPolicy), "no-referrer", fiber.HeaderReferrerPolicy)
	assertHeader(t, resp.Header.Get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()", "Permissions-Policy")
	assertHeader(t, resp.Header.Get(fiber.HeaderContentSecurityPolicy), apiContentSecurityPolicy, fiber.HeaderContentSecurityPolicy)
}

func TestGlobalSecurityMiddlewareAllowsConfiguredCORSOrigin(t *testing.T) {
	// given
	app := securityTestApp(&config.Config{
		CORSAllowedOrigins: []string{"https://app.example.test"},
	})
	req := httptest.NewRequest(fiber.MethodOptions, "/ok", nil)
	req.Header.Set(fiber.HeaderOrigin, "https://app.example.test")
	req.Header.Set(fiber.HeaderAccessControlRequestMethod, fiber.MethodGet)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	assertHeader(t, resp.Header.Get(fiber.HeaderAccessControlAllowOrigin), "https://app.example.test", fiber.HeaderAccessControlAllowOrigin)
}

func TestGlobalSecurityMiddlewareAllowsConfiguredWildcardSubdomain(t *testing.T) {
	// given
	app := securityTestApp(&config.Config{
		CORSAllowedOrigins: []string{"https://*.socialeventmapper.com"},
	})
	req := httptest.NewRequest(fiber.MethodOptions, "/ok", nil)
	req.Header.Set(fiber.HeaderOrigin, "https://api.socialeventmapper.com")
	req.Header.Set(fiber.HeaderAccessControlRequestMethod, fiber.MethodGet)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	assertHeader(t, resp.Header.Get(fiber.HeaderAccessControlAllowOrigin), "https://api.socialeventmapper.com", fiber.HeaderAccessControlAllowOrigin)
}

func TestGlobalSecurityMiddlewareRejectsOversizedBody(t *testing.T) {
	// given
	app := securityTestApp(&config.Config{MaxRequestBodyBytes: 8})
	req := httptest.NewRequest(fiber.MethodPost, "/echo", strings.NewReader("0123456789"))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMETextPlain)

	// when
	resp, err := app.Test(req)
	if err != nil {
		if !strings.Contains(err.Error(), "body size exceeds the given limit") {
			t.Fatalf("expected body limit error, got %v", err)
		}
		return
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", resp.StatusCode)
	}
}

func TestGlobalSecurityMiddlewareRecoversPanics(t *testing.T) {
	// given
	app := securityTestApp(nil)
	req := httptest.NewRequest(fiber.MethodGet, "/panic", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.StatusCode)
	}
}

func assertHeader(t *testing.T, got, want, name string) {
	t.Helper()
	if got != want {
		t.Fatalf("expected %s header %q, got %q", name, want, got)
	}
}
