package i18n

import "testing"

func TestResolveFromAcceptLanguage(t *testing.T) {
	cases := []struct {
		name   string
		header string
		want   Locale
		ok     bool
	}{
		{"empty", "", "", false},
		{"single tr", "tr", LocaleTR, true},
		{"single en", "en", LocaleEN, true},
		{"region tr-TR", "tr-TR", LocaleTR, true},
		{"q-weighted prefers tr", "tr;q=0.9, en;q=0.5", LocaleTR, true},
		{"q-weighted prefers en", "en;q=0.9, tr;q=0.5", LocaleEN, true},
		{"unsupported fr only", "fr", "", false},
		{"unsupported with q-zero supported", "fr, en;q=0.0", "", false},
		{"unsupported then supported", "fr, tr", LocaleTR, true},
		{"malformed falls back to false", "this is not a header", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := ResolveFromAcceptLanguage(tc.header)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v (got=%q)", ok, tc.ok, got)
			}
			if got != tc.want {
				t.Fatalf("locale = %q, want %q", got, tc.want)
			}
		})
	}
}
