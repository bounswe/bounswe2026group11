package httpapi

import (
	"context"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func loadResolveTestCatalog(t *testing.T) *i18n.Catalog {
	t.Helper()
	fsys := fstest.MapFS{
		"l/en.json": &fstest.MapFile{Data: []byte(`{"hello":"hello"}`)},
		"l/tr.json": &fstest.MapFile{Data: []byte(`{"hello":"merhaba"}`)},
	}
	cat, err := i18n.LoadFromFS(fsys, "l")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	return cat
}

// localeFakeVerifier returns fixed claims for any token; used to drive
// RequireAuth without a real JWT in locale-resolution tests.
type localeFakeVerifier struct {
	claims *domain.AuthClaims
}

func (f localeFakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, nil
}

func TestResolveLocaleHeaderOnly(t *testing.T) {
	SetTranslator(loadResolveTestCatalog(t))
	t.Cleanup(func() { SetTranslator(nil) })
	SetLocalePreferenceLookup(nil)

	cases := []struct {
		name   string
		header string
		want   i18n.Locale
	}{
		{"no header → default", "", i18n.LocaleEN},
		{"single tr", "tr", i18n.LocaleTR},
		{"region tr-TR", "tr-TR", i18n.LocaleTR},
		{"q-weighted prefers tr", "tr;q=0.9, en;q=0.5", i18n.LocaleTR},
		{"unsupported only → default", "fr", i18n.LocaleEN},
		{"unsupported then supported → tr", "fr, tr", i18n.LocaleTR},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := fiber.New(fiber.Config{DisableStartupMessage: true})
			app.Use(ResolveLocale())
			app.Get("/x", func(c *fiber.Ctx) error {
				return c.SendString(string(LocaleFromCtx(c)))
			})
			req := httptest.NewRequest("GET", "/x", nil)
			if tc.header != "" {
				req.Header.Set("Accept-Language", tc.header)
			}
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("Test: %v", err)
			}
			buf := make([]byte, 16)
			n, _ := resp.Body.Read(buf)
			if got := i18n.Locale(string(buf[:n])); got != tc.want {
				t.Fatalf("locale = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestResolveLocaleUserPreferenceOverridesDefault(t *testing.T) {
	SetTranslator(loadResolveTestCatalog(t))
	t.Cleanup(func() { SetTranslator(nil) })

	userID := uuid.New()
	SetLocalePreferenceLookup(func(_ context.Context, id uuid.UUID) (i18n.Locale, bool) {
		if id == userID {
			return i18n.LocaleTR, true
		}
		return "", false
	})
	t.Cleanup(func() { SetLocalePreferenceLookup(nil) })

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(ResolveLocale())
	auth := RequireAuth(localeFakeVerifier{claims: &domain.AuthClaims{UserID: userID, Role: domain.UserRoleUser}})
	app.Get("/protected", auth, func(c *fiber.Ctx) error {
		return c.SendString(string(LocaleFromCtx(c)))
	})

	t.Run("no header falls back to user pref tr", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/protected", nil)
		req.Header.Set("Authorization", "Bearer ignored")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("Test: %v", err)
		}
		buf := make([]byte, 16)
		n, _ := resp.Body.Read(buf)
		if got := i18n.Locale(string(buf[:n])); got != i18n.LocaleTR {
			t.Fatalf("locale = %q, want tr", got)
		}
	})

	t.Run("explicit header wins over user pref", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/protected", nil)
		req.Header.Set("Authorization", "Bearer ignored")
		req.Header.Set("Accept-Language", "en")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("Test: %v", err)
		}
		buf := make([]byte, 16)
		n, _ := resp.Body.Read(buf)
		if got := i18n.Locale(string(buf[:n])); got != i18n.LocaleEN {
			t.Fatalf("locale = %q, want en", got)
		}
	})

	t.Run("unsupported header falls through to user pref", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/protected", nil)
		req.Header.Set("Authorization", "Bearer ignored")
		req.Header.Set("Accept-Language", "fr")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("Test: %v", err)
		}
		buf := make([]byte, 16)
		n, _ := resp.Body.Read(buf)
		if got := i18n.Locale(string(buf[:n])); got != i18n.LocaleTR {
			t.Fatalf("locale = %q, want tr (fallback to user pref)", got)
		}
	})
}

func TestResolveLocaleNoPrefAndUnsupportedHeaderFallsToDefault(t *testing.T) {
	SetTranslator(loadResolveTestCatalog(t))
	t.Cleanup(func() { SetTranslator(nil) })
	SetLocalePreferenceLookup(func(_ context.Context, _ uuid.UUID) (i18n.Locale, bool) {
		return "", false
	})
	t.Cleanup(func() { SetLocalePreferenceLookup(nil) })

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(ResolveLocale())
	auth := RequireAuth(localeFakeVerifier{claims: &domain.AuthClaims{UserID: uuid.New(), Role: domain.UserRoleUser}})
	app.Get("/x", auth, func(c *fiber.Ctx) error {
		return c.SendString(string(LocaleFromCtx(c)))
	})

	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Authorization", "Bearer x")
	req.Header.Set("Accept-Language", "fr")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	buf := make([]byte, 16)
	n, _ := resp.Body.Read(buf)
	if got := i18n.Locale(string(buf[:n])); got != i18n.LocaleEN {
		t.Fatalf("locale = %q, want en (default)", got)
	}
}
