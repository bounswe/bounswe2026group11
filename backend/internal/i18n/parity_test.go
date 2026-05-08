package i18n

import (
	"sort"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/i18n/locales"
)

// TestEmbeddedCatalogLoads guarantees the embedded JSON files parse and
// every Supported locale ships a file. Regressions here should fail CI.
func TestEmbeddedCatalogLoads(t *testing.T) {
	if _, err := LoadFromFS(locales.FS, locales.Dir); err != nil {
		t.Fatalf("load embedded catalog: %v", err)
	}
}

// TestEmbeddedCatalogParity enforces that every translation key exists in
// every supported locale. Adding a key to en.json without adding it to
// tr.json (or vice versa) fails this test, which keeps the catalogs from
// drifting silently.
func TestEmbeddedCatalogParity(t *testing.T) {
	cat, err := LoadFromFS(locales.FS, locales.Dir)
	if err != nil {
		t.Fatalf("load embedded catalog: %v", err)
	}
	keysByLocale := make(map[Locale]map[string]bool, len(Supported))
	for _, loc := range Supported {
		set := make(map[string]bool)
		for _, k := range cat.Keys(loc) {
			set[k] = true
		}
		keysByLocale[loc] = set
	}
	union := make(map[string]bool)
	for _, set := range keysByLocale {
		for k := range set {
			union[k] = true
		}
	}
	for _, loc := range Supported {
		var missing []string
		for k := range union {
			if !keysByLocale[loc][k] {
				missing = append(missing, k)
			}
		}
		if len(missing) > 0 {
			sort.Strings(missing)
			t.Errorf("locale %q is missing %d key(s): %v", loc, len(missing), missing)
		}
	}
}
