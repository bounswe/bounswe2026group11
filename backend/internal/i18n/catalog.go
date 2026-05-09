package i18n

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"strings"
)

// Catalog holds translations for every supported Locale. It is read-only
// after construction and safe for concurrent use.
type Catalog struct {
	entries map[Locale]map[string]string
}

// LoadFromFS reads every "<locale>.json" file from dir and returns a
// Catalog. The locale code in the filename must match a Supported locale.
// Files for locales not in Supported are ignored. Missing files for
// supported locales cause an error so deployments fail fast.
func LoadFromFS(fsys fs.FS, dir string) (*Catalog, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, fmt.Errorf("i18n: read locales dir %q: %w", dir, err)
	}
	cat := &Catalog{entries: make(map[Locale]map[string]string, len(Supported))}
	seen := make(map[Locale]bool, len(Supported))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		base := strings.TrimSuffix(name, ".json")
		loc, ok := Parse(base)
		if !ok {
			continue
		}
		data, err := fs.ReadFile(fsys, path.Join(dir, name))
		if err != nil {
			return nil, fmt.Errorf("i18n: read %s: %w", name, err)
		}
		var kv map[string]string
		if err := json.Unmarshal(data, &kv); err != nil {
			return nil, fmt.Errorf("i18n: parse %s: %w", name, err)
		}
		cat.entries[loc] = kv
		seen[loc] = true
	}
	for _, loc := range Supported {
		if !seen[loc] {
			return nil, fmt.Errorf("i18n: missing catalog file for locale %q", loc)
		}
	}
	return cat, nil
}

// T resolves key for the requested locale. When the key is missing in loc
// it falls back to DefaultLocale; when missing in both it returns the key
// itself so callers see the unresolved identifier in responses (which makes
// the gap obvious in QA).
//
// args, when present, are passed to fmt.Sprintf using the resolved value as
// the format string.
func (c *Catalog) T(loc Locale, key string, args ...any) string {
	if c == nil {
		return formatOrKey(key, key, args)
	}
	if value, ok := c.entries[loc][key]; ok {
		return formatOrKey(value, key, args)
	}
	if loc != DefaultLocale {
		if value, ok := c.entries[DefaultLocale][key]; ok {
			return formatOrKey(value, key, args)
		}
	}
	return key
}

// Has reports whether the catalog contains key for loc (no fallback).
// Useful for tests that assert parity across locales.
func (c *Catalog) Has(loc Locale, key string) bool {
	if c == nil {
		return false
	}
	_, ok := c.entries[loc][key]
	return ok
}

// Keys returns the set of keys defined for loc. The returned slice is a
// copy and may be mutated by the caller.
func (c *Catalog) Keys(loc Locale) []string {
	if c == nil {
		return nil
	}
	src := c.entries[loc]
	keys := make([]string, 0, len(src))
	for k := range src {
		keys = append(keys, k)
	}
	return keys
}

func formatOrKey(value, key string, args []any) string {
	if len(args) == 0 {
		return value
	}
	if value == "" {
		return key
	}
	return fmt.Sprintf(value, args...)
}
