package i18n

import (
	"golang.org/x/text/language"
)

var supportedTags = func() []language.Tag {
	tags := make([]language.Tag, 0, len(Supported))
	for _, loc := range Supported {
		tags = append(tags, language.Make(string(loc)))
	}
	return tags
}()

var languageMatcher = language.NewMatcher(supportedTags)

// ResolveFromAcceptLanguage parses an Accept-Language header value, picks
// the best supported match using q-weights, and returns its base language
// as a Locale. When the header is empty or contains no supported language
// the second return value is false and the caller should fall back.
func ResolveFromAcceptLanguage(header string) (Locale, bool) {
	if header == "" {
		return "", false
	}
	tags, _, err := language.ParseAcceptLanguage(header)
	if err != nil || len(tags) == 0 {
		return "", false
	}
	_, idx, conf := languageMatcher.Match(tags...)
	if conf == language.No {
		return "", false
	}
	if idx < 0 || idx >= len(Supported) {
		return "", false
	}
	return Supported[idx], true
}
