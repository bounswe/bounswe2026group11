package httpapi

import (
	"errors"
	"log/slog"
	"sync/atomic"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
	"github.com/gofiber/fiber/v2"
)

// ErrorEnvelope wraps all error responses in a consistent JSON structure: {"error": {...}}.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody is the inner payload of an error response, containing a machine-
// readable code, a human-readable message, and optional per-field details.
type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

// translatorRef holds the package-level translator used by error responses.
// Stored via atomic.Pointer so SetTranslator can be called from server
// startup without locking the read path on every request.
var translatorRef atomic.Pointer[i18n.Catalog]

// SetTranslator installs the i18n catalog used to resolve MessageKey/
// DetailKeys on AppError into localized text. Calling with nil disables
// translation (errors fall back to their literal Message/Details).
func SetTranslator(cat *i18n.Catalog) {
	translatorRef.Store(cat)
}

// translatorFor returns the active translator or nil.
func translatorFor() *i18n.Catalog {
	return translatorRef.Load()
}

// WriteError converts err into a JSON error response. Known AppErrors are
// serialized with their original status; unexpected errors produce a 500.
// When the active translator can resolve MessageKey/DetailKeys for the
// request locale (i18n.LocaleFrom on the user context) those resolved
// strings replace the literal Message/Details.
func WriteError(c *fiber.Ctx, err error) error {
	if appErr, ok := errors.AsType[*domain.AppError](err); ok {
		body := ErrorBody{
			Code:    appErr.Code,
			Message: appErr.Message,
			Details: appErr.Details,
		}
		if cat := translatorFor(); cat != nil {
			loc := i18n.LocaleFrom(c.UserContext())
			if appErr.MessageKey != "" {
				body.Message = cat.T(loc, appErr.MessageKey)
			}
			if len(appErr.DetailKeys) > 0 {
				resolved := make(map[string]string, len(appErr.DetailKeys))
				for field, key := range appErr.DetailKeys {
					resolved[field] = cat.T(loc, key)
				}
				body.Details = resolved
			}
		}
		return c.Status(appErr.Status).JSON(ErrorEnvelope{Error: body})
	}

	slog.ErrorContext(c.UserContext(), "handler error",
		"error", err,
		"method", c.Method(),
		"path", c.Path(),
	)
	message := "An unexpected error occurred."
	if cat := translatorFor(); cat != nil {
		message = cat.T(i18n.LocaleFrom(c.UserContext()), "error.internal")
	}
	return c.Status(fiber.StatusInternalServerError).JSON(ErrorEnvelope{
		Error: ErrorBody{
			Code:    "internal_server_error",
			Message: message,
		},
	})
}
