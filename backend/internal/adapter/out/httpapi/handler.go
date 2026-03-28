package httpapi

import (
	"errors"
	"log"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
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

// WriteError converts err into a JSON error response. Known AppErrors are
// serialized with their original status; unexpected errors produce a 500.
func WriteError(c *fiber.Ctx, err error) error {
	if appErr, ok := errors.AsType[*domain.AppError](err); ok {
		return c.Status(appErr.Status).JSON(ErrorEnvelope{
			Error: ErrorBody{
				Code:    appErr.Code,
				Message: appErr.Message,
				Details: appErr.Details,
			},
		})
	}

	log.Printf("handler error: %v", err)
	return c.Status(fiber.StatusInternalServerError).JSON(ErrorEnvelope{
		Error: ErrorBody{
			Code:    "internal_server_error",
			Message: "An unexpected error occurred.",
		},
	})
}
