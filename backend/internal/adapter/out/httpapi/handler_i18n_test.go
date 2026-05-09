package httpapi

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
	"github.com/gofiber/fiber/v2"
)

func loadTestCatalog(t *testing.T) *i18n.Catalog {
	t.Helper()
	fsys := fstest.MapFS{
		"l/en.json": &fstest.MapFile{Data: []byte(`{
"error.validation":"validation failed",
"validation.gender.invalid":"gender is invalid",
"error.internal":"internal"
}`)},
		"l/tr.json": &fstest.MapFile{Data: []byte(`{
"error.validation":"doğrulama başarısız",
"validation.gender.invalid":"cinsiyet geçersiz",
"error.internal":"içsel hata"
}`)},
	}
	cat, err := i18n.LoadFromFS(fsys, "l")
	if err != nil {
		t.Fatalf("load test catalog: %v", err)
	}
	return cat
}

func newAppWithLocale(t *testing.T, loc i18n.Locale, handler fiber.Handler) *fiber.App {
	t.Helper()
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		c.SetUserContext(i18n.WithLocale(c.UserContext(), loc))
		return c.Next()
	})
	app.Get("/test", handler)
	return app
}

func TestWriteErrorResolvesMessageKey(t *testing.T) {
	SetTranslator(loadTestCatalog(t))
	t.Cleanup(func() { SetTranslator(nil) })

	cases := []struct {
		name        string
		loc         i18n.Locale
		wantMessage string
		wantDetail  string
	}{
		{"english", i18n.LocaleEN, "validation failed", "gender is invalid"},
		{"turkish", i18n.LocaleTR, "doğrulama başarısız", "cinsiyet geçersiz"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler := func(c *fiber.Ctx) error {
				return WriteError(c, domain.ValidationErrorI18n(map[string]string{
					"gender": "validation.gender.invalid",
				}))
			}
			app := newAppWithLocale(t, tc.loc, handler)
			req := httptest.NewRequest("GET", "/test", nil)
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("app.Test: %v", err)
			}
			if resp.StatusCode != domain.StatusBadRequest {
				t.Fatalf("status = %d, want %d", resp.StatusCode, domain.StatusBadRequest)
			}
			body, _ := io.ReadAll(resp.Body)
			var env ErrorEnvelope
			if err := json.Unmarshal(body, &env); err != nil {
				t.Fatalf("unmarshal: %v (body=%s)", err, body)
			}
			if env.Error.Code != domain.ErrorCodeValidation {
				t.Fatalf("code = %q, want %q", env.Error.Code, domain.ErrorCodeValidation)
			}
			if env.Error.Message != tc.wantMessage {
				t.Fatalf("message = %q, want %q", env.Error.Message, tc.wantMessage)
			}
			if env.Error.Details["gender"] != tc.wantDetail {
				t.Fatalf("details[gender] = %q, want %q", env.Error.Details["gender"], tc.wantDetail)
			}
		})
	}
}

func TestWriteErrorWithoutTranslatorFallsBackToLiteral(t *testing.T) {
	SetTranslator(nil)
	handler := func(c *fiber.Ctx) error {
		return WriteError(c, domain.ValidationError(map[string]string{
			"gender": "must be one of [MALE, FEMALE, OTHER]",
		}))
	}
	app := newAppWithLocale(t, i18n.LocaleTR, handler)
	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	var env ErrorEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if env.Error.Details["gender"] != "must be one of [MALE, FEMALE, OTHER]" {
		t.Fatalf("details[gender] = %q, want literal passthrough", env.Error.Details["gender"])
	}
}
