// Package i18n provides locale resolution and message translation for
// backend-owned, user-facing strings. Catalog files live under locales/ and
// are embedded at build time.
package i18n

import "strings"

// Locale identifies a supported translation catalog. Use the package
// constants; do not construct values from arbitrary strings without going
// through Parse.
type Locale string

const (
	LocaleEN Locale = "en"
	LocaleTR Locale = "tr"

	// DefaultLocale is the locale used when no preference can be resolved
	// and as the fallback when a key is missing in the requested locale.
	DefaultLocale = LocaleEN
)

// Supported is the canonical, ordered list of locales the backend ships
// translations for. The order seeds the language matcher, so put the
// default first.
var Supported = []Locale{LocaleEN, LocaleTR}

// Parse normalizes an input string (e.g. "TR", "tr-TR", "en_US") into a
// supported Locale. Region/script subtags are stripped; matching is
// case-insensitive on the base language tag.
func Parse(s string) (Locale, bool) {
	if s == "" {
		return "", false
	}
	base := s
	for i, r := range s {
		if r == '-' || r == '_' {
			base = s[:i]
			break
		}
	}
	base = strings.ToLower(base)
	for _, loc := range Supported {
		if string(loc) == base {
			return loc, true
		}
	}
	return "", false
}
