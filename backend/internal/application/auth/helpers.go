package auth

import (
	"errors"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// mapRepoError extracts an AppError from a wrapped repository error so the
// HTTP layer can return the correct status code instead of a generic 500.
func mapRepoError(err error) error {
	if appErr, ok := errors.AsType[*domain.AppError](err); ok {
		return appErr
	}
	return err
}

func otpRateLimitKey(purpose, email string) string {
	return purpose + ":" + email
}

func isAppErrorCode(err error, code string) bool {
	if appErr, ok := errors.AsType[*domain.AppError](err); ok {
		return appErr.Code == code
	}
	return false
}

func passwordResetTokenError() error {
	return domain.AuthError(domain.ErrorCodeInvalidResetToken, "The password reset session is invalid or has expired.")
}
