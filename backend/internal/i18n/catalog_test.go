package i18n

import (
	"testing"
	"testing/fstest"
)

func newTestCatalog(t *testing.T) *Catalog {
	t.Helper()
	fsys := fstest.MapFS{
		"locales/en.json": &fstest.MapFile{Data: []byte(`{
"hello":"Hello",
"only_en":"only english",
"with_args":"Hi %s, you have %d messages"
}`)},
		"locales/tr.json": &fstest.MapFile{Data: []byte(`{
"hello":"Merhaba",
"with_args":"Selam %s, %d mesajın var"
}`)},
	}
	cat, err := LoadFromFS(fsys, "locales")
	if err != nil {
		t.Fatalf("LoadFromFS: %v", err)
	}
	return cat
}

func TestCatalogTranslate(t *testing.T) {
	cat := newTestCatalog(t)
	cases := []struct {
		name string
		loc  Locale
		key  string
		args []any
		want string
	}{
		{"hit en", LocaleEN, "hello", nil, "Hello"},
		{"hit tr", LocaleTR, "hello", nil, "Merhaba"},
		{"missing in tr falls back to en", LocaleTR, "only_en", nil, "only english"},
		{"missing in both returns key", LocaleTR, "absent", nil, "absent"},
		{"args en", LocaleEN, "with_args", []any{"Ada", 3}, "Hi Ada, you have 3 messages"},
		{"args tr", LocaleTR, "with_args", []any{"Ada", 3}, "Selam Ada, 3 mesajın var"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := cat.T(tc.loc, tc.key, tc.args...)
			if got != tc.want {
				t.Fatalf("T = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCatalogLoadMissingLocaleFails(t *testing.T) {
	fsys := fstest.MapFS{
		"locales/en.json": &fstest.MapFile{Data: []byte(`{"k":"v"}`)},
	}
	if _, err := LoadFromFS(fsys, "locales"); err == nil {
		t.Fatal("expected error when a supported locale file is missing, got nil")
	}
}

func TestCatalogNilSafe(t *testing.T) {
	var cat *Catalog
	if got := cat.T(LocaleEN, "anything"); got != "anything" {
		t.Fatalf("nil catalog T = %q, want key passthrough", got)
	}
	if cat.Has(LocaleEN, "x") {
		t.Fatal("nil catalog should report no keys")
	}
}
