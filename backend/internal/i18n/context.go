package i18n

import "context"

type ctxKey struct{}

// WithLocale returns a derived context carrying the resolved request locale.
func WithLocale(ctx context.Context, loc Locale) context.Context {
	return context.WithValue(ctx, ctxKey{}, loc)
}

// LocaleFrom reads the locale stored on ctx by WithLocale. It returns
// DefaultLocale when no locale has been attached, so callers never need
// to special-case the unset path.
func LocaleFrom(ctx context.Context) Locale {
	if loc, ok := ctx.Value(ctxKey{}).(Locale); ok && loc != "" {
		return loc
	}
	return DefaultLocale
}
