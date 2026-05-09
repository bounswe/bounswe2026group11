package i18n

import (
	"context"
	"testing"
)

func TestParse(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  Locale
		ok    bool
	}{
		{"empty", "", "", false},
		{"plain en", "en", LocaleEN, true},
		{"plain tr", "tr", LocaleTR, true},
		{"upper TR", "TR", LocaleTR, true},
		{"region tr-TR", "tr-TR", LocaleTR, true},
		{"underscore en_US", "en_US", LocaleEN, true},
		{"unsupported fr", "fr", "", false},
		{"unsupported region fr-FR", "fr-FR", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := Parse(tc.input)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if got != tc.want {
				t.Fatalf("locale = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestLocaleFromContext(t *testing.T) {
	if got := LocaleFrom(context.Background()); got != DefaultLocale {
		t.Fatalf("empty ctx = %q, want default %q", got, DefaultLocale)
	}
	ctx := WithLocale(context.Background(), LocaleTR)
	if got := LocaleFrom(ctx); got != LocaleTR {
		t.Fatalf("ctx = %q, want %q", got, LocaleTR)
	}
}
